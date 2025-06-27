import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

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
    let response = NextResponse.redirect(new URL('/app', requestUrl.origin))

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value
          },
          set(name: string, value: string, options: any) {
            request.cookies.set({ name, value, ...options })
            response = NextResponse.redirect(new URL('/app', requestUrl.origin))
            response.cookies.set({ name, value, ...options })
          },
          remove(name: string, options: any) {
            request.cookies.set({ name, value: '', ...options })
            response = NextResponse.redirect(new URL('/app', requestUrl.origin))
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

      if (data.user) {
        console.log('OAuth login successful for user:', data.user.id)
        console.log('User metadata:', data.user.user_metadata)
        
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

        // Check if user profile exists, create if not
        let { data: profile, error: profileSelectError } = await supabase
          .from('profiles')
          .select('first_time')
          .eq('id', data.user.id)
          .single()

        console.log('Profile lookup result:', { profile, profileSelectError })

        // Create profile if it doesn't exist (for OAuth users)
        if (!profile) {
          console.log('Creating new profile for OAuth user')
          const { data: newProfile, error: profileError } = await supabase
            .from('profiles')
            .insert({
              id: data.user.id,
              email: data.user.email,
              name: data.user.user_metadata?.full_name || data.user.user_metadata?.name,
              picture_url: data.user.user_metadata?.avatar_url || data.user.user_metadata?.picture,
              first_time: true,
              mfa_enabled: false
            })
            .select('first_time')
            .single()

          if (profileError) {
            console.error('Error creating profile:', profileError)
            // Continue anyway, user can still use the app
          } else {
            console.log('Profile created successfully:', newProfile)
            profile = newProfile
          }
        } else {
          console.log('Existing profile found:', profile)
        }

        // Determine redirect URL
        const redirectTo = state ? decodeURIComponent(state) : '/app'
        const finalRedirect = profile?.first_time ? '/onboarding' : redirectTo
        
        // Update response redirect URL
        response = NextResponse.redirect(new URL(finalRedirect, requestUrl.origin))
        return response
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