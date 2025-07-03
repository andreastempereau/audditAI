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

        // Ensure profile exists - use UPSERT to handle race conditions
        console.log('Ensuring profile exists for user:', data.user.id)
        
        const { data: profile, error: upsertError } = await supabase
          .from('profiles')
          .upsert({
            id: data.user.id,
            email: data.user.email,
            name: data.user.user_metadata?.full_name || data.user.user_metadata?.name || data.user.email?.split('@')[0],
            picture_url: data.user.user_metadata?.picture || data.user.user_metadata?.avatar_url,
            first_time: true,
            mfa_enabled: false,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'id',
            ignoreDuplicates: false
          })
          .select()
          .single()

        if (upsertError) {
          console.error('Error upserting profile:', upsertError)
          // Try a simple select in case the profile exists but upsert failed
          const { data: existingProfile, error: selectError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', data.user.id)
            .single()
          
          if (selectError) {
            console.error('Error selecting existing profile:', selectError)
            // Continue without profile - client can handle this
          } else {
            console.log('Found existing profile after upsert error:', existingProfile)
          }
        } else {
          console.log('Profile upserted successfully:', profile)
        }

        // Determine redirect: onboarding if no user OR user has no organizations
        let finalRedirect = '/onboarding'; // Default to onboarding for safety
        
        if (!profile) {
          // No profile found - need onboarding
          console.log('No profile found - redirecting to onboarding');
          finalRedirect = '/onboarding';
        } else {
          // Profile exists - check if they have organizations
          try {
            // Use a simple count query to avoid RLS join issues
            const { count, error: orgsError } = await supabase
              .from('user_organizations')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', data.user.id);
            
            console.log('User organizations count:', { count, orgsError });
            
            if (orgsError) {
              console.error('Error checking organization count:', orgsError);
              // If we can't check organizations, send to onboarding for safety
              console.log('Cannot verify organizations - redirecting to onboarding');
              finalRedirect = '/onboarding';
            } else if (count === 0) {
              // No organizations - need onboarding
              console.log('User has no organizations - redirecting to onboarding');
              finalRedirect = '/onboarding';
            } else {
              // User has organizations - can access dashboard
              console.log(`User has ${count} organization(s) - allowing dashboard access`);
              finalRedirect = state && state !== 'null' ? decodeURIComponent(state) : '/dashboard';
            }
          } catch (orgCheckError) {
            console.error('Exception during organization check:', orgCheckError);
            // On any error, send to onboarding to be safe
            console.log('Organization check failed - redirecting to onboarding');
            finalRedirect = '/onboarding';
          }
        }
        
        console.log('OAuth callback complete - redirecting to:', finalRedirect);
        
        // Add a small delay to ensure all async operations complete
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Create redirect response with all the cookies from the previous response
        const redirectResponse = NextResponse.redirect(new URL(finalRedirect, requestUrl.origin))
        
        // Copy all cookies from the auth response to the redirect response
        response.cookies.getAll().forEach((cookie) => {
          redirectResponse.cookies.set(cookie.name, cookie.value)
        })
        
        // Add a header to indicate this was an OAuth callback
        redirectResponse.headers.set('X-Auth-Callback', 'oauth')
        
        return redirectResponse
      } else {
        console.error('OAuth callback: No user or session in response')
        return NextResponse.redirect(
          new URL(`/login?error=${encodeURIComponent('No session established')}`, requestUrl.origin)
        )
      }
    } catch (err) {
      console.error('OAuth callback error:', err)
      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent('An unexpected error occurred')}`, requestUrl.origin)
      )
    }
  }

  // If no code, redirect to login
  return NextResponse.redirect(new URL('/login', requestUrl.origin))
}