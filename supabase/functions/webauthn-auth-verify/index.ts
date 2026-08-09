/**
 * webauthn-auth-verify
 *
 * The final gate before attendance is marked.
 * Verifies the WebAuthn assertion, then if ALL checks pass, inserts the attendance record.
 *
 * Full security checklist:
 *  ✓ Valid ICMS JWT
 *  ✓ Student exists
 *  ✓ Credential belongs to student (ownership verified server-side)
 *  ✓ Challenge valid + not expired
 *  ✓ Challenge not reused
 *  ✓ Origin valid
 *  ✓ RP ID valid
 *  ✓ Signature valid (ECDSA P-256)
 *  ✓ Sign counter valid (prevents replay)
 *  ✓ QR session exists
 *  ✓ Session active
 *  ✓ Session not expired
 *  ✓ GPS within radius (if configured)
 *  ✓ Duplicate attendance prevented
 *
 * POST /functions/v1/webauthn-auth-verify
 * Headers: Authorization: Bearer <ICMS_JWT>
 * Body: {
 *   "challenge": "<base64url>",
 *   "session_id": "<uuid>",
 *   "credential": {
 *     "id": "<base64url credential id>",
 *     "type": "public-key",
 *     "response": {
 *       "clientDataJSON": "<base64url>",
 *       "authenticatorData": "<base64url>",
 *       "signature": "<base64url>",
 *       "userHandle": "<base64url|null>"
 *     }
 *   },
 *   "latitude": null,
 *   "longitude": null
 * }
 */
import { serve } from 'https://deno.land/std@0.192.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { verifyICMSJWT, corsHeaders } from '../_shared/auth.ts';
import {
  decodeBase64url,
  parseCoseKey,
  parseAuthData,
  verifyAssertionSignature,
  verifyRpIdHash,
} from '../_shared/webauthn.ts';

// Haversine distance in metres
function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const f1 = (lat1 * Math.PI) / 180, f2 = (lat2 * Math.PI) / 180;
  const df = ((lat2 - lat1) * Math.PI) / 180;
  const dl = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(df / 2) ** 2 + Math.cos(f1) * Math.cos(f2) * Math.sin(dl / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // ── 1. Verify ICMS JWT ────────────────────────────────────────────────────
    const jwtUser = await verifyICMSJWT(req);
    const userId = jwtUser.id;

    const { challenge, session_id, credential, latitude, longitude } = await req.json();
    if (!challenge || !session_id || !credential) {
      throw new Error('challenge, session_id, and credential are required');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // ── 2. Resolve student_id from JWT (authoritative) ────────────────────────
    const { data: student, error: studentErr } = await supabase
      .from('students')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (studentErr || !student) throw new Error('Student profile not found.');

    // ── 3. Validate challenge ─────────────────────────────────────────────────
    const { data: challengeRow, error: challengeErr } = await supabase
      .from('webauthn_challenges')
      .select('*')
      .eq('challenge', challenge)
      .eq('student_id', student.id)
      .eq('session_id', session_id)
      .eq('purpose', 'authenticate')
      .eq('used', false)
      .single();

    if (challengeErr || !challengeRow) throw new Error('Invalid or expired challenge.');
    if (new Date(challengeRow.expires_at) < new Date()) throw new Error('Challenge expired. Please try again.');

    // 4. Mark challenge used immediately (before any more async work)
    await supabase.from('webauthn_challenges').update({ used: true }).eq('id', challengeRow.id);

    // ── 5. Look up the credential — MUST belong to this student ──────────────
    const credentialId = credential.id; // base64url
    const { data: storedCred, error: credErr } = await supabase
      .from('biometric_credentials')
      .select('*')
      .eq('credential_id', credentialId)
      .eq('student_id', student.id)  // ownership check — prevents cross-student attack
      .single();

    if (credErr || !storedCred) {
      throw new Error('Credential not found or does not belong to this student.');
    }

    // ── 6. Decode WebAuthn response bytes ─────────────────────────────────────
    const clientDataJSON = decodeBase64url(credential.response.clientDataJSON);
    const authenticatorData = decodeBase64url(credential.response.authenticatorData);
    const signatureBytes = decodeBase64url(credential.response.signature);

    // ── 7. Verify clientDataJSON ──────────────────────────────────────────────
    const clientData = JSON.parse(new TextDecoder().decode(clientDataJSON));

    if (clientData.type !== 'webauthn.get') throw new Error('Invalid clientData type.');

    const expectedOrigin = Deno.env.get('WEBAUTHN_ORIGIN') || 'http://localhost:3000';
    if (clientData.origin !== expectedOrigin) {
      throw new Error(`Origin mismatch. Expected ${expectedOrigin}, got ${clientData.origin}.`);
    }

    if (clientData.challenge !== challenge) throw new Error('Challenge mismatch.');

    // ── 8. Parse and verify authenticatorData ─────────────────────────────────
    const authData = parseAuthData(authenticatorData);

    const rpId = Deno.env.get('WEBAUTHN_RP_ID') || 'localhost';
    if (!(await verifyRpIdHash(authData.rpIdHash, rpId))) {
      throw new Error('RP ID mismatch.');
    }

    // User verification flag (UV = 0x04) must be set — biometric was used
    if (!(authData.flags & 0x04)) {
      throw new Error('User verification not performed. Biometric is required.');
    }

    // ── 9. Verify signature ───────────────────────────────────────────────────
    const publicKey = await parseCoseKey(storedCred.public_key);
    const signatureValid = await verifyAssertionSignature(
      publicKey,
      signatureBytes,
      authenticatorData,
      clientDataJSON,
    );

    if (!signatureValid) throw new Error('Signature verification failed.');

    // ── 10. Verify sign counter (prevents cloned authenticator replay) ────────
    if (authData.signCount > 0 && authData.signCount <= storedCred.sign_count) {
      throw new Error('Sign counter invalid — possible authenticator clone detected.');
    }

    // Update sign_count and last_used_at
    await supabase
      .from('biometric_credentials')
      .update({ sign_count: authData.signCount, last_used_at: new Date().toISOString() })
      .eq('id', storedCred.id);

    // ── 11. Verify attendance session ─────────────────────────────────────────
    const { data: session, error: sessionErr } = await supabase
      .from('attendance_sessions')
      .select('*')
      .eq('id', session_id)
      .single();

    if (sessionErr || !session) throw new Error('Invalid or non-existent attendance session.');
    if (!session.is_active) throw new Error('This attendance session has been closed.');
    if (new Date(session.expires_at) < new Date()) throw new Error('This attendance session has expired.');

    // ── 12. GPS radius check ──────────────────────────────────────────────────
    if (session.gps_latitude && session.gps_longitude && session.gps_radius) {
      if (!latitude || !longitude) throw new Error('Please enable location access to mark attendance.');
      const dist = haversine(session.gps_latitude, session.gps_longitude, latitude, longitude);
      if (dist > session.gps_radius) throw new Error('You are outside the permitted attendance location.');
    }

    // ── 13. Resolve student name ──────────────────────────────────────────────
    const { data: user } = await supabase
      .from('users')
      .select('full_name, ic_number')
      .eq('id', userId)
      .single();

    // ── 14. Insert attendance record (duplicate prevented by unique constraint) ─
    const { data: record, error: insertErr } = await supabase
      .from('attendance_records')
      .insert({
        session_id,
        student_id: student.id,
        student_name: user?.full_name || 'Unknown Student',
        student_identifier: user?.ic_number || String(userId),
        latitude: latitude ?? null,
        longitude: longitude ?? null,
        device_id: `webauthn:${credentialId.slice(0, 16)}`,
      })
      .select()
      .single();

    if (insertErr) {
      if (insertErr.code === '23505') throw new Error('Attendance has already been marked for this session.');
      throw insertErr;
    }

    return new Response(
      JSON.stringify({ success: true, record }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err: any) {
    const status = err.message.includes('JWT') || err.message.includes('origin') ? 401
      : err.message.includes('already been marked') ? 409
      : 400;
    return new Response(JSON.stringify({ error: err.message }), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
