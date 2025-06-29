import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const state = requestUrl.searchParams.get('state')
  const error = requestUrl.searchParams.get('error')
  const error_description = requestUrl.searchParams.get('error_description')

  if (error) {
    console.error('OAuth error:', error, error_description)
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error_description || error)}`, requestUrl.origin)
    )
  }

  if (code) {
    // Create a new NextResponse that we'll modify and return
    const response = NextResponse.next()

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value
          },
          set(name: string, value: string, options: any) {
            // Set cookie on the response
            response.cookies.set({ name, value, ...options })
          },
          remove(name: string, options: any) {
            // Remove cookie from the response
            response.cookies.set({ name, value: '', ...options })
          },
        },
      }
    )
    
    try {
      // Exchange code for session
      const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
      
      if (exchangeError) {
        console.error('Error exchanging code for session:', exchangeError)
        return NextResponse.redirect(
          new URL(`/login?error=${encodeURIComponent('Authentication failed')}`, requestUrl.origin)
        )
      }

      if (data.user && data.session) {
        console.log('OAuth login successful for user:', data.user.id)
        console.log('User metadata:', data.user.user_metadata)
        console.log('Session established:', !!data.session)
        
        // Verify the session is valid
        const { data: { user: sessionUser }, error: sessionError } = await supabase.auth.getUser()
        
        if (sessionError || !sessionUser) {
          console.error('Session verification failed:', sessionError)
          return NextResponse.redirect(
            new URL(`/login?error=${encodeURIComponent('Session verification failed')}`, requestUrl.origin)
          )
        }
        
        console.log('Session verified for user:', sessionUser.id)
        
        // Log successful OAuth login
        try {
          await supabase.rpc('log_auth_event', {
            p_user_id: data.user.id,
            p_action: 'oauth_login_success',
            p_metadata: { 
              provider: data.user.app_metadata?.provider,
              ip_address: request.headers.get('x-forwarded-for') || request.ip
            }
          })
        } catch (logError) {
          console.error('Error logging auth event:', logError)
          // Continue anyway
        }

        // Check if user profile exists (database trigger should have created it)
        let { data: profile, error: profileSelectError } = await supabase
          .from('profiles')
          .select('first_time')
          .eq('id', data.user.id)
          .single()

        console.log('Profile lookup result:', { profile, profileSelectError })

        // If profile doesn't exist, wait a moment and try again (database trigger might be running)
        if (!profile && profileSelectError?.code === 'PGRST116') {
          console.log('Profile not found, waiting for database trigger to complete...')
          await new Promise(resolve => setTimeout(resolve, 1000))
          
          const { data: retryProfile, error: retryError } = await supabase
            .from('profiles')
            .select('first_time')
            .eq('id', data.user.id)
            .single()
          
          if (retryProfile) {
            console.log('Profile found on retry:', retryProfile)
            profile = retryProfile
          } else {
            console.error('Profile still not found after retry:', retryError)
            // Continue anyway - the client-side auth provider will handle this
          }
        } else if (profile) {
          console.log('Existing profile found:', profile)
        }

        // Check if user has any organizations
        const { data: userOrgs } = await supabase
          .from('user_organizations')
          .select('id')
          .eq('user_id', data.user.id)
          .limit(1);

        // Determine redirect URL based on user state
        let finalRedirect = '/app';
        
        // If user has first_time flag or no organizations, redirect to onboarding
        if (profile?.first_time || !userOrgs || userOrgs.length === 0) {
          console.log('User needs onboarding - first_time:', profile?.first_time, 'orgs:', userOrgs?.length);
          finalRedirect = '/onboarding';
        } else if (state && state !== 'null') {
          // Use the state parameter if provided and valid
          finalRedirect = decodeURIComponent(state);
        }
        
        console.log('Redirecting to:', finalRedirect);
        
        // Create redirect response with all the cookies from the previous response
        const redirectResponse = NextResponse.redirect(new URL(finalRedirect, requestUrl.origin))
        
        // Copy all cookies from the auth response to the redirect response
        response.cookies.getAll().forEach((cookie) => {
          redirectResponse.cookies.set(cookie.name, cookie.value)
        })
        
        return redirectResponse
      } else {
        console.error('OAuth callback: No user or session in response')
        return NextResponse.redirect(
          new URL(`/login?error=${encodeURIComponent('No session established')}`, requestUrl.origin)
        )
      }
    } catch (error) {
      console.error('Unexpected error in OAuth callback:', error)
      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent('Authentication failed')}`, requestUrl.origin)
      )
    }
  }

  // No code parameter, redirect to login
  return NextResponse.redirect(new URL('/login', requestUrl.origin))
}