import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set({ name, value, ...options })
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set({ name, value, ...options })
          })
        },
      },
    }
  )

  // Get the current session
  const { data: { session }, error } = await supabase.auth.getSession()
  
  // Log session status for debugging
  console.log('Middleware session check:', {
    pathname: request.nextUrl.pathname,
    hasSession: !!session,
    userId: session?.user?.id,
    error: error?.message
  })

  const { pathname } = request.nextUrl

  // Skip middleware for auth callback to prevent redirect loops
  if (pathname.startsWith('/auth/callback')) {
    return response
  }

  // Define protected routes
  const protectedRoutes = ['/app', '/onboarding']
  const authRoutes = ['/login', '/register', '/verify-email', '/forgot-password']
  
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route))
  const isAuthRoute = authRoutes.some(route => pathname.startsWith(route))

  // If user is not authenticated and trying to access protected route
  if (isProtectedRoute && !session) {
    const redirectUrl = new URL('/login', request.url)
    redirectUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(redirectUrl)
  }

  // If user is authenticated and trying to access auth routes, redirect to app
  if (isAuthRoute && session) {
    return NextResponse.redirect(new URL('/app', request.url))
  }

  // If user is authenticated and on landing page, redirect to app (unless they need onboarding)
  if (session && pathname === '/') {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('first_time')
        .eq('id', session.user.id)
        .single()

      if (profile?.first_time) {
        return NextResponse.redirect(new URL('/onboarding', request.url))
      } else {
        return NextResponse.redirect(new URL('/app', request.url))
      }
    } catch (error) {
      console.error('Error checking user profile for root redirect:', error)
      // Default to onboarding for safety
      return NextResponse.redirect(new URL('/onboarding', request.url))
    }
  }

  // Check if user needs onboarding (for /app routes)
  if (session && pathname.startsWith('/app') && pathname !== '/onboarding') {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('first_time')
        .eq('id', session.user.id)
        .single()

      if (profile?.first_time) {
        return NextResponse.redirect(new URL('/onboarding', request.url))
      }
    } catch (error) {
      console.error('Error checking user profile:', error)
    }
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}