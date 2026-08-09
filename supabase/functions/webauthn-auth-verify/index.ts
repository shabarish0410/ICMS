/**
 * webauthn-auth-verify  (v3 — efficient lookup, graceful errors)
 *
 * Public endpoint — no JWT required. Full security gate.
 * POST /functions/v1/webauthn-auth-verify
 */
import { serve } from 'https://deno.land/std@0.192.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/auth.ts';
import {
  decodeBase64url,
  parseCoseKey,
  parseAuthData,
  verifyAssertionSignature,
  verifyRpIdHash,
} from '../_shared/webauthn.ts';

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const f1 = (lat1 * Math.PI) / 180, f2 = (lat2 * Math.PI) / 180;
  const df = ((lat2 - lat1) * Math.PI) / 180, dl = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(df / 2) ** 2 + Math.cos(f1) * Math.cos(f2) * Math.sin(dl / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { ic_number, challenge, session_id, credential, latitude, longitude } = await req.json();
    if (!ic_number || !challenge || !session_id || !credential) {
      throw new Error('ic_number, challenge, session_id, and credential are required');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const ic = ic_number.trim().toUpperCase();

    // ── 1. Efficient user lookup ──────────────────────────────────────────────
    let dbUser: any = null;
    const { data: byIc, error: icErr } = await supabase
      .from('users').select('id, ic_number, full_name').ilike('ic_number', ic).maybeSingle();

    if (icErr) throw new Error(`Database error: ${icErr.message}`);
    if (byIc) { dbUser = byIc; }
    else {
      const { data: byName, error: nameErr } = await supabase
        .from('users').select('id, ic_number, full_name').ilike('full_name', ic).maybeSingle();
      if (nameErr) throw new Error(`Database error: ${nameErr.message}`);
      if (byName) dbUser = byName;
    }
    if (!dbUser) throw new Error(`No student found with ID or name '${ic}'.`);

    // ── 2. Resolve student_id ─────────────────────────────────────────────────
    const { data: student, error: studentErr } = await supabase
      .from('students').select('id').eq('user_id', dbUser.id).maybeSingle();
    if (studentErr) throw new Error(`Database error: ${studentErr.message}`);
    if (!student) throw new Error('Student profile not found.');

    // ── 3. Validate challenge ─────────────────────────────────────────────────
    const { data: challengeRow, error: challengeErr } = await supabase
      .from('webauthn_challenges')
      .select('*')
      .eq('challenge', challenge)
      .eq('student_id', student.id)
      .eq('session_id', session_id)
      .eq('purpose', 'authenticate')
      .eq('used', false)
      .maybeSingle();

    if (challengeErr) throw new Error(`Challenge lookup error: ${challengeErr.message}`);
    if (!challengeRow) throw new Error('Invalid or expired challenge. Please restart the attendance process.');
    if (new Date(challengeRow.expires_at) < new Date()) throw new Error('Challenge expired. Please try again.');

    await supabase.from('webauthn_challenges').update({ used: true }).eq('id', challengeRow.id);

    // ── 4. Verify credential ownership ───────────────────────────────────────
    const credentialId = credential.id;
    const { data: storedCred, error: credErr } = await supabase
      .from('biometric_credentials')
      .select('*')
      .eq('credential_id', credentialId)
      .eq('student_id', student.id)
      .maybeSingle();

    if (credErr) throw new Error(`Credential lookup error: ${credErr.message}`);
    if (!storedCred) throw new Error('Credential not registered for this student. Please register first.');

    // ── 5. Decode + verify WebAuthn assertion ─────────────────────────────────
    const clientDataJSON = decodeBase64url(credential.response.clientDataJSON);
    const authenticatorData = decodeBase64url(credential.response.authenticatorData);
    const signatureBytes = decodeBase64url(credential.response.signature);

    const clientData = JSON.parse(new TextDecoder().decode(clientDataJSON));
    if (clientData.type !== 'webauthn.get') throw new Error('Invalid clientData type.');

    const expectedOrigin = Deno.env.get('WEBAUTHN_ORIGIN') || 'http://localhost:3000';
    if (clientData.origin !== expectedOrigin) {
      throw new Error(`Origin mismatch. Got: ${clientData.origin}`);
    }
    if (clientData.challenge !== challenge) throw new Error('Challenge mismatch.');

    const authData = parseAuthData(authenticatorData);
    const rpId = Deno.env.get('WEBAUTHN_RP_ID') || 'localhost';
    if (!(await verifyRpIdHash(authData.rpIdHash, rpId))) throw new Error('RP ID mismatch.');
    if (!(authData.flags & 0x04)) throw new Error('User verification not performed.');

    const publicKey = await parseCoseKey(storedCred.public_key);
    const valid = await verifyAssertionSignature(publicKey, signatureBytes, authenticatorData, clientDataJSON);
    if (!valid) throw new Error('Signature verification failed — please try again.');

    if (authData.signCount > 0 && authData.signCount <= storedCred.sign_count) {
      throw new Error('Sign counter invalid — possible replay attack detected.');
    }
    await supabase.from('biometric_credentials')
      .update({ sign_count: authData.signCount, last_used_at: new Date().toISOString() })
      .eq('id', storedCred.id);

    // ── 6. Verify session ─────────────────────────────────────────────────────
    const { data: session, error: sessionErr } = await supabase
      .from('attendance_sessions').select('*').eq('id', session_id).maybeSingle();
    if (sessionErr) throw new Error(`Session lookup error: ${sessionErr.message}`);
    if (!session) throw new Error('Attendance session not found.');
    if (!session.is_active) throw new Error('This attendance session has been closed.');
    if (new Date(session.expires_at) < new Date()) throw new Error('This attendance session has expired.');

    // ── 7. GPS check ──────────────────────────────────────────────────────────
    if (session.gps_latitude && session.gps_longitude && session.gps_radius) {
      if (!latitude || !longitude) throw new Error('Please enable location access to mark attendance.');
      const dist = haversine(session.gps_latitude, session.gps_longitude, latitude, longitude);
      if (dist > session.gps_radius) throw new Error('You are outside the permitted attendance location.');
    }

    // ── 8. Insert attendance record ───────────────────────────────────────────
    const { data: record, error: insertErr } = await supabase
      .from('attendance_records')
      .insert({
        session_id,
        student_id: student.id,
        student_name: dbUser.full_name || 'Unknown Student',
        student_identifier: dbUser.ic_number || ic,
        latitude: latitude ?? null,
        longitude: longitude ?? null,
        device_id: `webauthn:${credentialId.slice(0, 16)}`,
      })
      .select()
      .single();

    if (insertErr) {
      if (insertErr.code === '23505') throw new Error('Attendance has already been marked for this session.');
      throw new Error(`Could not record attendance: ${insertErr.message}`);
    }

    return new Response(
      JSON.stringify({ success: true, record }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err: any) {
    console.error('[webauthn-auth-verify]', err.message);
    const status = err.message.includes('already been marked') ? 409 : 400;
    return new Response(JSON.stringify({ error: err.message }), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
