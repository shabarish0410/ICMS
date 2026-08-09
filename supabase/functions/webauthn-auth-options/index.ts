/**
 * webauthn-auth-options
 *
 * Public endpoint — no JWT required.
 * Returns challenge + all known credential IDs for this student.
 * Returns 404 with NO_CREDENTIALS if student has no registered credentials (trigger registration).
 *
 * POST /functions/v1/webauthn-auth-options
 * Body: { "session_id": "<uuid>", "ic_number": "IC2024004" }
 */
import { serve } from 'https://deno.land/std@0.192.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/auth.ts';
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

    // 1. Resolve student by ic_number (flexible matching)
    const ic = ic_number.trim().toUpperCase();
    const { data: users } = await supabase.from('users').select('id, ic_number, full_name').execute();
    const icClean = ic.replace(/-/g, '').replace(/ /g, '');
    const matched = (users || []).filter((u: any) => {
      const uIc = (u.ic_number || '').replace(/-/g, '').replace(/ /g, '').toUpperCase();
      const uName = (u.full_name || '').trim().toUpperCase();
      return uIc === icClean || uName === ic;
    });
    if (!matched.length) throw new Error(`No student found with ID '${ic}'.`);

    const { data: student, error: studentErr } = await supabase
      .from('students').select('id').eq('user_id', matched[0].id).single();
    if (studentErr || !student) throw new Error('Student profile not found.');

    // 2. Look up all credentials for this student
    const { data: credentials, error: credsErr } = await supabase
      .from('biometric_credentials')
      .select('credential_id')
      .eq('student_id', student.id);

    if (credsErr) throw credsErr;

    // Signal frontend to switch to registration flow
    if (!credentials || credentials.length === 0) {
      return new Response(
        JSON.stringify({ error: 'NO_CREDENTIALS', message: 'No biometric registered. Please register first.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 3. Generate challenge
    const challenge = generateChallenge();
    const { error: challengeErr } = await supabase
      .from('webauthn_challenges')
      .insert({ challenge, student_id: student.id, session_id, purpose: 'authenticate' });

    if (challengeErr) throw challengeErr;

    const rpId = Deno.env.get('WEBAUTHN_RP_ID') || 'localhost';
    const options = {
      challenge,
      rpId,
      allowCredentials: credentials.map((c) => ({
        id: c.credential_id,
        type: 'public-key',
        transports: ['internal'],
      })),
      userVerification: 'required',
      timeout: 60000,
    };

    return new Response(JSON.stringify(options), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
