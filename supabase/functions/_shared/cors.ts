/**
 * Minimal CORS headers for Supabase Edge Functions.
 * Kept separate from auth.ts so functions that don't need JWT
 * don't pull in the JWT/djwt dependency at module load time.
 */
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
