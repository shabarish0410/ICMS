import { serve } from 'https://deno.land/std@0.192.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { verifyICMSJWT, corsHeaders } from '../_shared/auth.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const user = await verifyICMSJWT(req);
    
    // Check if admin/faculty
    if (user.role !== 'admin' && user.role !== 'faculty') {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const url = new URL(req.url);
    const session_id = url.searchParams.get('session_id');

    if (!session_id) {
      throw new Error('session_id parameter is required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify session ownership
    const { data: session, error: getError } = await supabase
      .from('attendance_sessions')
      .select('faculty_id')
      .eq('id', session_id)
      .single();

    if (getError || !session) {
      throw new Error('Session not found');
    }

    if (user.role !== 'admin' && session.faculty_id !== user.id) {
      throw new Error('Unauthorized to view this session');
    }

    const { data, error } = await supabase
      .from('attendance_records')
      .select('*')
      .eq('session_id', session_id)
      .order('marked_at', { ascending: false });

    if (error) throw error;

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
