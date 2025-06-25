import { NextRequest, NextResponse } from 'next/server';

export function middleware(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith('/app') && !req.cookies.get('user')) {
    return NextResponse.redirect(new URL('/', req.url));
  }
  return NextResponse.next();
}
