import { serve } from 'https://deno.land/std@0.192.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { verifyICMSJWT, corsHeaders } from '../_shared/auth.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const user = await verifyICMSJWT(req);
    if (user.role !== 'admin' && user.role !== 'faculty') {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const {
      subject_name,
      section,
      duration_minutes,
      generator_latitude,
      generator_longitude,
      generator_accuracy_meters,
      allowed_radius_meters,
      location_captured_at
    } = await req.json();

    if (
      typeof generator_latitude !== "number" ||
      typeof generator_longitude !== "number"
    ) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "INVALID_GENERATOR_LOCATION",
          message: "Valid generator location is required.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (generator_latitude < -90 || generator_latitude > 90) {
      return new Response(
        JSON.stringify({ success: false, error: "INVALID_LATITUDE" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (generator_longitude < -180 || generator_longitude > 180) {
      return new Response(
        JSON.stringify({ success: false, error: "INVALID_LONGITUDE" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const expires_at = new Date(Date.now() + duration_minutes * 60000).toISOString();

    const { data, error } = await supabase
      .from('attendance_sessions')
      .insert({
        subject_name,
        section,
        faculty_id: user.id,
        expires_at,
        is_active: true,
        generator_latitude,
        generator_longitude,
        generator_accuracy_meters,
        allowed_radius_meters,
        location_captured_at
      })
      .select()
      .single();

    if (error) throw error;

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
