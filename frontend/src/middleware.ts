import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Routes that don't need authentication
const publicRoutes = ['/login', '/register', '/forgot-password', '/complete-profile'];

// Routes that should redirect to dashboard if already authenticated
const authOnlyRoutes = ['/login', '/register'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Read token from cookie (set by the login page) or Authorization header
  // We use cookies here because localStorage isn't available in middleware (edge runtime)
  const token = request.cookies.get('access_token')?.value;

  const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route));
  const isAuthOnlyRoute = authOnlyRoutes.some((route) => pathname.startsWith(route));
  const isDashboardRoute = pathname.startsWith('/dashboard');

  // If already authenticated and trying to access login/register → send to dashboard
  if (token && isAuthOnlyRoute) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // If not authenticated and trying to access protected routes → send to login
  if (!token && isDashboardRoute) {
    const url = new URL('/login', request.url);
    url.searchParams.set('from', pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico
     * - public files (e.g. /manifest.json, /sw.js, /icons/*)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|manifest.json|sw.js|icons|.*\\.png$|.*\\.jpg$|.*\\.svg$).*)',
  ],
};
