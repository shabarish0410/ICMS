/**
 * webauthn-register-options
 *
 * Public endpoint — no ICMS JWT required.
 * Student is identified by ic_number (same as the existing mark-attendance edge function).
 *
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

    // 1. Look up user by IC number (with flexible matching, same as mark-attendance)
    const ic = ic_number.trim().toUpperCase();
    let userId: number | null = null;
    let studentId: number | null = null;
    let displayName = 'ICMS Student';
    let displayIc = ic;

    const { data: users } = await supabase
      .from('users')
      .select('id, full_name, ic_number')
      .execute();

    const icClean = ic.replace(/-/g, '').replace(/ /g, '');
    const matched = (users || []).filter((u: any) => {
      const uIc = (u.ic_number || '').replace(/-/g, '').replace(/ /g, '').toUpperCase();
      const uName = (u.full_name || '').trim().toUpperCase();
      return uIc === icClean || uName === ic;
    });

    if (!matched.length) throw new Error(`No student found with ID or name '${ic}'.`);
    const user = matched[0];
    userId = user.id;
    displayName = user.full_name || 'ICMS Student';
    displayIc = user.ic_number || ic;

    // 2. Resolve student_id
    const { data: student, error: studentErr } = await supabase
      .from('students')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (studentErr || !student) throw new Error('Student profile not found.');
    studentId = student.id;

    // 3. Generate challenge and store it
    const challenge = generateChallenge();
    const { error: challengeErr } = await supabase
      .from('webauthn_challenges')
      .insert({ challenge, student_id: studentId, session_id, purpose: 'register' });

    if (challengeErr) throw challengeErr;

    // 4. Return PublicKeyCredentialCreationOptions
    const rpId = Deno.env.get('WEBAUTHN_RP_ID') || 'localhost';
    const options = {
      challenge,
      rp: { id: rpId, name: 'ICMS — Innovation Center' },
      user: {
        id: encodeBase64url(new TextEncoder().encode(String(studentId))),
        name: displayIc,
        displayName,
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
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
