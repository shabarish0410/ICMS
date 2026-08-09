import { serve } from 'https://deno.land/std@0.192.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { verifyICMSJWT, corsHeaders } from '../_shared/auth.ts';

// Haversine formula to calculate distance in meters
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // metres
  const φ1 = lat1 * Math.PI / 180; // φ, λ in radians
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // in metres
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { session_id, latitude, longitude, device_id, ic_number } = await req.json();

    if (!ic_number) {
      return new Response(JSON.stringify({ error: 'IC Number is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Get the user by ic_number
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, role_id')
      .eq('ic_number', ic_number.toUpperCase())
      .single();

    if (userError || !user) {
      throw new Error('Invalid IC Number or user not found');
    }

    // 2. Get the student from users.id
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (studentError || !student) {
      throw new Error('Student profile not found for this user');
    }

    // 3. Get the session
    const { data: session, error: sessionError } = await supabase
      .from('attendance_sessions')
      .select('*')
      .eq('id', session_id)
      .single();

    if (sessionError || !session) {
      throw new Error('Invalid or non-existent session');
    }

    if (!session.is_active) {
      throw new Error('This attendance session has been closed.');
    }

    if (new Date(session.expires_at) < new Date()) {
      throw new Error('This attendance session has expired.');
    }

    // 4. Verify GPS if configured
    if (session.gps_latitude && session.gps_longitude && session.gps_radius) {
      if (!latitude || !longitude) {
        throw new Error('Please enable location access to mark attendance.');
      }
      const distance = calculateDistance(
        session.gps_latitude, session.gps_longitude,
        latitude, longitude
      );
      if (distance > session.gps_radius) {
        throw new Error('You are outside the permitted attendance location.');
      }
    }

    // 5. Insert Attendance Record
    const { data: record, error: insertError } = await supabase
      .from('attendance_records')
      .insert({
        session_id,
        student_id: student.id,
        student_name: user.full_name || 'Unknown Student',
        student_identifier: ic_number.toUpperCase(),
        latitude,
        longitude,
        device_id
      })
      .select()
      .single();

    if (insertError) {
      // Postgres unique violation code is 23505
      if (insertError.code === '23505') {
        throw new Error('Attendance has already been marked for this session.');
      }
      throw insertError;
    }

    return new Response(JSON.stringify(record), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
