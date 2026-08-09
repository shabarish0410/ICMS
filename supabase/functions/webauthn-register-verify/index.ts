/**
 * webauthn-register-verify  (v3 — efficient lookup, graceful errors)
 *
 * Public endpoint — no JWT required.
 * POST /functions/v1/webauthn-register-verify
 */
import { serve } from 'https://deno.land/std@0.192.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import {
  decodeBase64url,
  encodeBase64url,
  parseAuthData,
  verifyRpIdHash,
} from '../_shared/webauthn.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { ic_number, challenge, credential, device_label } = await req.json();
    if (!ic_number || !challenge || !credential) {
      throw new Error('ic_number, challenge, and credential are required');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const ic = ic_number.trim().toUpperCase();

    // 1. Efficient lookup by ic_number or name
    let dbUser: any = null;
    const { data: byIc } = await supabase
      .from('users').select('id, ic_number, full_name').ilike('ic_number', ic).maybeSingle();
    if (byIc) { dbUser = byIc; }
    else {
      const { data: byName } = await supabase
        .from('users').select('id, ic_number, full_name').ilike('full_name', ic).maybeSingle();
      if (byName) dbUser = byName;
    }
    if (!dbUser) throw new Error(`No student found with ID or name '${ic}'.`);

    const { data: student, error: studentErr } = await supabase
      .from('students').select('id').eq('user_id', dbUser.id).maybeSingle();
    if (studentErr) throw new Error(`Database error: ${studentErr.message}`);
    if (!student) throw new Error('Student profile not found.');

    // 2. Validate challenge
    const { data: challengeRow, error: challengeErr } = await supabase
      .from('webauthn_challenges')
      .select('*')
      .eq('challenge', challenge)
      .eq('student_id', student.id)
      .eq('purpose', 'register')
      .eq('used', false)
      .maybeSingle();

    if (challengeErr) throw new Error(`Challenge lookup error: ${challengeErr.message}`);
    if (!challengeRow) throw new Error('Invalid or expired challenge. Please try again from the start.');
    if (new Date(challengeRow.expires_at) < new Date()) throw new Error('Challenge expired. Please restart.');

    await supabase.from('webauthn_challenges').update({ used: true }).eq('id', challengeRow.id);

    // 3. Verify clientDataJSON
    const clientDataJSON = decodeBase64url(credential.response.clientDataJSON);
    const clientData = JSON.parse(new TextDecoder().decode(clientDataJSON));
    if (clientData.type !== 'webauthn.create') throw new Error('Invalid credential type.');

    const expectedOrigin = Deno.env.get('WEBAUTHN_ORIGIN') || 'http://localhost:3000';
    if (clientData.origin !== expectedOrigin) {
      throw new Error(`Origin mismatch. Got: ${clientData.origin} — expected: ${expectedOrigin}`);
    }
    if (clientData.challenge !== challenge) throw new Error('Challenge mismatch.');

    // 4. Extract authData
    const attestationBytes = decodeBase64url(credential.response.attestationObject);
    const authDataBytes = extractAuthData(attestationBytes);
    const authData = parseAuthData(authDataBytes);

    // 5. Verify RP ID
    const rpId = Deno.env.get('WEBAUTHN_RP_ID') || 'localhost';
    if (!(await verifyRpIdHash(authData.rpIdHash, rpId))) throw new Error('RP ID mismatch.');
    if (!(authData.flags & 0x04)) throw new Error('User verification not performed.');
    if (!authData.credentialId || !authData.credentialPublicKey) throw new Error('Missing credential data.');

    const credentialId = encodeBase64url(authData.credentialId);
    const publicKey = encodeBase64url(authData.credentialPublicKey);

    // 6. Store credential (upsert safe)
    const { error: insertErr } = await supabase
      .from('biometric_credentials')
      .upsert(
        { student_id: student.id, credential_id: credentialId, public_key: publicKey,
          sign_count: authData.signCount, device_label: device_label || null },
        { onConflict: 'credential_id' }
      );
    if (insertErr) throw new Error(`Could not save credential: ${insertErr.message}`);

    return new Response(
      JSON.stringify({ success: true, credential_id: credentialId }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err: any) {
    console.error('[webauthn-register-verify]', err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function extractAuthData(cbor: Uint8Array): Uint8Array {
  const key = new TextEncoder().encode('authData');
  for (let i = 0; i < cbor.length - key.length; i++) {
    if (cbor[i] === 0x68) {
      let match = true;
      for (let j = 0; j < key.length; j++) { if (cbor[i + 1 + j] !== key[j]) { match = false; break; } }
      if (match) {
        const next = cbor[i + 9];
        if (next === 0x58) { const len = cbor[i + 10]; return cbor.slice(i + 11, i + 11 + len); }
        if (next === 0x59) { const len = (cbor[i + 10] << 8) | cbor[i + 11]; return cbor.slice(i + 12, i + 12 + len); }
      }
    }
  }
  throw new Error('Could not extract authData from attestationObject.');
}
