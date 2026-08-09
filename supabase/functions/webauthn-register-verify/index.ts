/**
 * webauthn-register-verify
 *
 * Verifies a WebAuthn registration response and stores the public key credential.
 * Does NOT mark attendance — registration and authentication are separate operations.
 *
 * POST /functions/v1/webauthn-register-verify
 * Headers: Authorization: Bearer <ICMS_JWT>
 * Body: {
 *   "challenge": "<base64url>",
 *   "credential": {
 *     "id": "<base64url credential id>",
 *     "rawId": "<base64url>",
 *     "type": "public-key",
 *     "response": {
 *       "clientDataJSON": "<base64url>",
 *       "attestationObject": "<base64url>"
 *     }
 *   },
 *   "device_label": "Samsung Galaxy S23"
 * }
 */
import { serve } from 'https://deno.land/std@0.192.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { verifyICMSJWT, corsHeaders } from '../_shared/auth.ts';
import {
  decodeBase64url,
  encodeBase64url,
  parseAuthData,
  verifyRpIdHash,
} from '../_shared/webauthn.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // 1. Verify ICMS JWT
    const jwtUser = await verifyICMSJWT(req);
    const userId = jwtUser.id;

    const { challenge, credential, device_label } = await req.json();
    if (!challenge || !credential) throw new Error('challenge and credential are required');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // 2. Resolve student_id from JWT
    const { data: student, error: studentErr } = await supabase
      .from('students')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (studentErr || !student) throw new Error('Student profile not found.');

    // 3. Validate challenge — must exist, belong to this student, be unused, not expired
    const { data: challengeRow, error: challengeErr } = await supabase
      .from('webauthn_challenges')
      .select('*')
      .eq('challenge', challenge)
      .eq('student_id', student.id)
      .eq('purpose', 'register')
      .eq('used', false)
      .single();

    if (challengeErr || !challengeRow) throw new Error('Invalid or expired challenge.');

    if (new Date(challengeRow.expires_at) < new Date()) {
      throw new Error('Challenge has expired. Please try again.');
    }

    // 4. Mark challenge as used immediately to prevent replay
    await supabase
      .from('webauthn_challenges')
      .update({ used: true })
      .eq('id', challengeRow.id);

    // 5. Decode clientDataJSON and verify it
    const clientDataJSON = decodeBase64url(credential.response.clientDataJSON);
    const clientData = JSON.parse(new TextDecoder().decode(clientDataJSON));

    if (clientData.type !== 'webauthn.create') {
      throw new Error('Invalid clientData type.');
    }

    const expectedOrigin = Deno.env.get('WEBAUTHN_ORIGIN') || 'http://localhost:3000';
    if (clientData.origin !== expectedOrigin) {
      throw new Error(`Invalid origin. Expected ${expectedOrigin}, got ${clientData.origin}`);
    }

    // Verify the challenge matches (decoded from base64url)
    const clientChallenge = clientData.challenge; // base64url in clientDataJSON
    if (clientChallenge !== challenge) {
      throw new Error('Challenge mismatch.');
    }

    // 6. Decode attestationObject (CBOR) — minimal parse to extract authData
    // The attestationObject is: { fmt, attStmt, authData }
    // We do a simple CBOR scan for the 'authData' byte string.
    const attestationBytes = decodeBase64url(credential.response.attestationObject);
    const authDataBytes = extractAuthDataFromAttestation(attestationBytes);

    // 7. Parse authenticatorData
    const authData = parseAuthData(authDataBytes);

    // 8. Verify RP ID hash
    const rpId = Deno.env.get('WEBAUTHN_RP_ID') || 'localhost';
    const rpIdValid = await verifyRpIdHash(authData.rpIdHash, rpId);
    if (!rpIdValid) throw new Error('RP ID mismatch — credential not for this site.');

    // 9. Verify user verification flag (UV bit = 0x04) — ensures biometric was used
    const UV_FLAG = 0x04;
    if (!(authData.flags & UV_FLAG)) {
      throw new Error('User verification was not performed. Biometric required.');
    }

    // 10. Extract credential ID and public key from authData
    if (!authData.credentialId || !authData.credentialPublicKey) {
      throw new Error('Missing credential data in authenticatorData.');
    }

    const credentialId = encodeBase64url(authData.credentialId);
    const publicKey = encodeBase64url(authData.credentialPublicKey);

    // 11. Store the credential — service role only, RLS enforced
    const { error: insertErr } = await supabase
      .from('biometric_credentials')
      .insert({
        student_id: student.id,
        credential_id: credentialId,
        public_key: publicKey,
        sign_count: authData.signCount,
        device_label: device_label || null,
      });

    if (insertErr) {
      if (insertErr.code === '23505') {
        // Credential already registered — update device_label and last_used_at
        await supabase
          .from('biometric_credentials')
          .update({ device_label: device_label || null, last_used_at: new Date().toISOString() })
          .eq('credential_id', credentialId);
      } else {
        throw insertErr;
      }
    }

    return new Response(
      JSON.stringify({ success: true, credential_id: credentialId }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: err.message.includes('JWT') || err.message.includes('origin') ? 401 : 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

/**
 * Minimal CBOR extraction of the 'authData' byte string from an attestationObject.
 * attestationObject is a CBOR map: { fmt: tstr, attStmt: map, authData: bstr }
 * We scan for the text key "authData" and return the following byte string.
 */
function extractAuthDataFromAttestation(cbor: Uint8Array): Uint8Array {
  const authDataKey = new TextEncoder().encode('authData');
  for (let i = 0; i < cbor.length - authDataKey.length; i++) {
    // Find the CBOR text string "authData" (0x68 = tstr of length 8)
    if (cbor[i] === 0x68) {
      let match = true;
      for (let j = 0; j < authDataKey.length; j++) {
        if (cbor[i + 1 + j] !== authDataKey[j]) { match = false; break; }
      }
      if (match) {
        // The byte string follows: 0x58,len or 0x59,len_hi,len_lo
        const nextByte = cbor[i + 9];
        if (nextByte === 0x58) {
          const len = cbor[i + 10];
          return cbor.slice(i + 11, i + 11 + len);
        } else if (nextByte === 0x59) {
          const len = (cbor[i + 10] << 8) | cbor[i + 11];
          return cbor.slice(i + 12, i + 12 + len);
        }
      }
    }
  }
  throw new Error('Could not extract authData from attestationObject.');
}
