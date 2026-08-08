import { verify } from 'https://deno.land/x/djwt@v3.0.1/mod.ts';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Replace this with the actual environment variable used by ICMS for JWT
const JWT_SECRET = Deno.env.get('JWT_SECRET_KEY') || Deno.env.get('SECRET_KEY');

export async function verifyICMSJWT(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    throw new Error('No authorization header');
  }

  const token = authHeader.replace('Bearer ', '');
  if (!token) {
    throw new Error('Invalid token format');
  }

  if (!JWT_SECRET) {
    throw new Error('JWT configuration error on server');
  }

  // Import key for djwt
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(JWT_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );

  const payload = await verify(token, key);
  
  if (!payload.sub) {
    throw new Error('Invalid token payload: missing sub');
  }

  return {
    id: Number(payload.sub),
    role: payload.role as string
  };
}
