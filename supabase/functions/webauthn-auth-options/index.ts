/**
 * webauthn-auth-options  (v3 — efficient lookup, graceful errors)
 *
 * Public endpoint — no JWT required.
 * POST /functions/v1/webauthn-auth-options
 * Body: { "session_id": "<uuid>", "ic_number": "IC2024004" }
 *
 * Returns 404 + NO_CREDENTIALS if student hasn't registered yet → frontend switches to register flow.
 */
import { serve } from 'https://deno.land/std@0.192.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { generateChallenge } from '../_shared/webauthn.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { session_id, ic_number } = await req.json();
    if (!session_id || !ic_number) throw new Error('session_id and ic_number are required');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const ic = ic_number.trim().toUpperCase();

    // 1. Efficient indexed lookup — ic_number first, name fallback
    let dbUser: any = null;
    const { data: byIc, error: icErr } = await supabase
      .from('users').select('id, ic_number, full_name').ilike('ic_number', ic).maybeSingle();

    if (icErr) throw new Error(`Database error: ${icErr.message}`);

    if (byIc) {
      dbUser = byIc;
    } else {
      const { data: byName, error: nameErr } = await supabase
        .from('users').select('id, ic_number, full_name').ilike('full_name', ic).maybeSingle();
      if (nameErr) throw new Error(`Database error: ${nameErr.message}`);
      if (byName) dbUser = byName;
    }

    if (!dbUser) throw new Error(`No student found with ID or name '${ic}'.`);

    // 2. Resolve student_id
    const { data: student, error: studentErr } = await supabase
      .from('students').select('id').eq('user_id', dbUser.id).maybeSingle();

    if (studentErr) throw new Error(`Database error: ${studentErr.message}`);
    if (!student) throw new Error('Student profile not found for this user.');

    // 3. Look up all registered credentials for this student
    const { data: credentials, error: credsErr } = await supabase
      .from('biometric_credentials').select('credential_id').eq('student_id', student.id);

    if (credsErr) throw new Error(`Credential lookup error: ${credsErr.message}`);

    // Signal frontend to start registration flow instead
    if (!credentials || credentials.length === 0) {
      return new Response(
        JSON.stringify({ error: 'NO_CREDENTIALS', message: 'No biometric registered. Switching to registration.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 4. Generate and store challenge
    const challenge = generateChallenge();
    const { error: challengeErr } = await supabase
      .from('webauthn_challenges')
      .insert({ challenge, student_id: student.id, session_id, purpose: 'authenticate' });

    if (challengeErr) throw new Error(`Could not create challenge: ${challengeErr.message}`);

    const rpId = Deno.env.get('WEBAUTHN_RP_ID') || 'localhost';

    return new Response(
      JSON.stringify({
        challenge,
        rpId,
        allowCredentials: credentials.map((c) => ({
          id: c.credential_id,
          type: 'public-key',
          transports: ['internal'],
        })),
        userVerification: 'required',
        timeout: 60000,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err: any) {
    console.error('[webauthn-auth-options]', err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
