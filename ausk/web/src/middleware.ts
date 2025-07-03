import { NextRequest, NextResponse } from 'next/server';

export function middleware(req: NextRequest) {
  // For now, let client-side AuthGuard handle all auth redirects
  // This prevents infinite redirect loops between middleware and client-side auth
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     * - auth/callback (OAuth callback)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\..*|auth/callback).*)',
  ],
};
