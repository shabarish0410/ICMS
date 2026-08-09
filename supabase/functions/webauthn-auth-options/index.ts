/**
 * webauthn-auth-options
 *
 * Returns PublicKeyCredentialRequestOptions for a returning student.
 * Includes all known credential IDs for this student so the browser
 * can select the right one (works across multiple registered devices).
 *
 * POST /functions/v1/webauthn-auth-options
 * Headers: Authorization: Bearer <ICMS_JWT>
 * Body: { "session_id": "<uuid>" }
 */
import { serve } from 'https://deno.land/std@0.192.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { verifyICMSJWT, corsHeaders } from '../_shared/auth.ts';
import { generateChallenge } from '../_shared/webauthn.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // 1. Verify ICMS JWT — student identity comes from the token
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

    // 3. Look up all credential IDs registered for this student.
    //    A student may have Credential A (Phone 1), Credential B (Phone 2), etc.
    //    The browser will use whichever it has access to.
    const { data: credentials, error: credsErr } = await supabase
      .from('biometric_credentials')
      .select('credential_id')
      .eq('student_id', student.id);

    if (credsErr) throw credsErr;

    // If no credentials registered yet, tell the frontend to switch to registration flow
    if (!credentials || credentials.length === 0) {
      return new Response(
        JSON.stringify({ error: 'NO_CREDENTIALS', message: 'No biometric registered. Please register first.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 4. Generate a fresh challenge
    const challenge = generateChallenge();

    // 5. Store challenge in DB (single-use, 2-minute TTL)
    const { error: challengeErr } = await supabase
      .from('webauthn_challenges')
      .insert({
        challenge,
        student_id: student.id,
        session_id,
        purpose: 'authenticate',
      });

    if (challengeErr) throw challengeErr;

    const rpId = Deno.env.get('WEBAUTHN_RP_ID') || 'localhost';

    // 6. Return PublicKeyCredentialRequestOptions
    const options = {
      challenge,
      rpId,
      allowCredentials: credentials.map((c) => ({
        id: c.credential_id,
        type: 'public-key',
        transports: ['internal'], // platform authenticator (built-in biometric)
      })),
      userVerification: 'required', // biometric mandatory — no PIN bypass
      timeout: 60000,
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
