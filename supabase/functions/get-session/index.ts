import { serve } from 'https://deno.land/std@0.192.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { verifyICMSJWT, corsHeaders } from '../_shared/auth.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Verify JWT - ensures only authenticated users can check session details
    await verifyICMSJWT(req);

    const url = new URL(req.url);
    const session_id = url.searchParams.get('session_id');

    if (!session_id) {
      throw new Error('session_id parameter is required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data, error } = await supabase
      .from('attendance_sessions')
      .select('id, subject_name, section, is_active, expires_at, gps_radius')
      .eq('id', session_id)
      .single();

    if (error || !data) {
      throw new Error('Session not found');
    }

    // Do not return exact GPS coordinates to students to prevent spoofing calculations manually,
    // though the radius is useful for UI hints.

    return new Response(JSON.stringify(data), {
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
