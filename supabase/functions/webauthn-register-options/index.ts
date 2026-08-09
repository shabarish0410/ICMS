/**
 * webauthn-register-options
 *
 * Returns PublicKeyCredentialCreationOptions for a first-time biometric registration.
 * The student must be authenticated with a valid ICMS JWT.
 *
 * POST /functions/v1/webauthn-register-options
 * Headers: Authorization: Bearer <ICMS_JWT>
 * Body: { "session_id": "<uuid>" }
 */
import { serve } from 'https://deno.land/std@0.192.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { verifyICMSJWT, corsHeaders } from '../_shared/auth.ts';
import { generateChallenge, encodeBase64url } from '../_shared/webauthn.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // 1. Verify ICMS JWT — identity comes from the token, never from the request body
    const jwtUser = await verifyICMSJWT(req);
    const userId = jwtUser.id;

    const { session_id } = await req.json();
    if (!session_id) throw new Error('session_id is required');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // 2. Resolve student_id from JWT user id
    const { data: student, error: studentErr } = await supabase
      .from('students')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (studentErr || !student) throw new Error('Student profile not found.');

    // 3. Look up student's display name for the credential UI
    const { data: user } = await supabase
      .from('users')
      .select('full_name, ic_number')
      .eq('id', userId)
      .single();

    // 4. Generate a fresh cryptographic challenge
    const challenge = generateChallenge();

    // 5. Store challenge in DB — single-use, expires in 2 minutes
    const { error: challengeErr } = await supabase
      .from('webauthn_challenges')
      .insert({
        challenge,
        student_id: student.id,
        session_id,
        purpose: 'register',
      });

    if (challengeErr) throw challengeErr;

    // 6. Build and return PublicKeyCredentialCreationOptions
    const rpId = Deno.env.get('WEBAUTHN_RP_ID') || 'localhost';

    const options = {
      challenge,
      rp: {
        id: rpId,
        name: 'ICMS — Innovation Center',
      },
      user: {
        // user.id must be base64url — we use the student's integer id
        id: encodeBase64url(new TextEncoder().encode(String(student.id))),
        name: user?.ic_number || String(userId),
        displayName: user?.full_name || 'ICMS Student',
      },
      pubKeyCredParams: [
        { alg: -7, type: 'public-key' },   // ES256 (ECDSA P-256) — universal support
        { alg: -257, type: 'public-key' }, // RS256 — Windows Hello fallback
      ],
      authenticatorSelection: {
        // 'platform' = built-in authenticator (fingerprint / Face ID / Windows Hello)
        authenticatorAttachment: 'platform',
        // 'required' means the device MUST verify the user biometrically (no PIN fallback)
        userVerification: 'required',
        residentKey: 'preferred',
      },
      timeout: 60000,
      attestation: 'none', // we don't need attestation certificates for this use case
    };

    return new Response(JSON.stringify(options), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: err.message.includes('JWT') ? 401 : 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
