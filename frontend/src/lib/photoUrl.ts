/**
 * Resolves an attendance photo_url to a displayable image src.
 *
 * Handles three cases:
 *  1. Full Supabase Storage URL → returned as-is
 *  2. Local relative path (/uploads/filename.jpg) → prefixed with backend base URL
 *  3. Any other absolute URL → returned as-is
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_BUCKET = process.env.NEXT_PUBLIC_STORAGE_BUCKET ?? 'attendance-photos';
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'https://icms-2ykq.onrender.com';

/**
 * Returns a fully-qualified image URL from a stored photo_url value.
 * Returns null if no URL is provided.
 */
export function resolvePhotoUrl(photoUrl: string | null | undefined): string | null {
  if (!photoUrl || photoUrl === 'null' || photoUrl === 'undefined') return null;

  // Already a full URL (Supabase Storage or external)
  if (photoUrl.startsWith('http://') || photoUrl.startsWith('https://')) {
    return encodeURI(photoUrl);
  }

  // Local relative path (e.g. /uploads/abc123.jpg)
  if (photoUrl.startsWith('/uploads/')) {
    return `${BACKEND_URL}${encodeURI(photoUrl)}`;
  }

  // Bare filename – assume it lives in Supabase Storage
  const filename = photoUrl.replace(/^\//, '');
  return `${SUPABASE_URL}/storage/v1/object/public/${SUPABASE_BUCKET}/${encodeURIComponent(filename)}`;
}

/**
 * Returns a Supabase Storage public URL for a given filename.
 */
export function supabasePublicUrl(filename: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/${SUPABASE_BUCKET}/${encodeURIComponent(filename)}`;
}
