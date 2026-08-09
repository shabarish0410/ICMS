/**
 * webauthn-register-options  (v3 — efficient ic_number lookup, graceful errors)
 *
 * Public endpoint — no JWT required.
 * POST /functions/v1/webauthn-register-options
 * Body: { "session_id": "<uuid>", "ic_number": "IC2024004" }
 */
import { serve } from 'https://deno.land/std@0.192.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/auth.ts';
import { generateChallenge, encodeBase64url } from '../_shared/webauthn.ts';

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

    // 1. Efficient lookup — try exact ic_number first, then name
    let dbUser: any = null;

    const { data: byIc } = await supabase
      .from('users')
      .select('id, full_name, ic_number')
      .ilike('ic_number', ic)
      .maybeSingle();

    if (byIc) {
      dbUser = byIc;
    } else {
      const { data: byName } = await supabase
        .from('users')
        .select('id, full_name, ic_number')
        .ilike('full_name', ic)
        .maybeSingle();
      if (byName) dbUser = byName;
    }

    if (!dbUser) throw new Error(`No student found with ID or name '${ic}'.`);

    // 2. Resolve student_id
    const { data: student, error: studentErr } = await supabase
      .from('students')
      .select('id')
      .eq('user_id', dbUser.id)
      .maybeSingle();

    if (studentErr) throw new Error(`Database error: ${studentErr.message}`);
    if (!student) throw new Error('Student profile not found for this user.');

    // 3. Generate and store challenge
    const challenge = generateChallenge();
    const { error: challengeErr } = await supabase
      .from('webauthn_challenges')
      .insert({ challenge, student_id: student.id, session_id, purpose: 'register' });

    if (challengeErr) throw new Error(`Could not create challenge: ${challengeErr.message}`);

    const rpId = Deno.env.get('WEBAUTHN_RP_ID') || 'localhost';

    const options = {
      challenge,
      rp: { id: rpId, name: 'ICMS — Innovation Center' },
      user: {
        id: encodeBase64url(new TextEncoder().encode(String(student.id))),
        name: dbUser.ic_number || ic,
        displayName: dbUser.full_name || 'ICMS Student',
      },
      pubKeyCredParams: [
        { alg: -7, type: 'public-key' },   // ES256
        { alg: -257, type: 'public-key' }, // RS256 fallback
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        residentKey: 'preferred',
      },
      timeout: 60000,
      attestation: 'none',
    };

    return new Response(JSON.stringify(options), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('[webauthn-register-options]', err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
