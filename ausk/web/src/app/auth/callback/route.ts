import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

// Input validation schemas
const userMetadataSchema = z.object({
  full_name: z.string().max(100).regex(/^[a-zA-Z\s'-]{1,100}$/).optional(),
  name: z.string().max(100).regex(/^[a-zA-Z\s'-]{1,100}$/).optional(),
  picture: z.string().url().max(500).optional(),
  avatar_url: z.string().url().max(500).optional(),
}).strict()

const emailSchema = z.string().email().max(254)

// Valid redirect paths - only allow internal redirects
const ALLOWED_REDIRECT_PATHS = [
  '/dashboard',
  '/onboarding',
  '/app',
  '/profile'
]

// Validate redirect URL to prevent open redirect attacks
function validateRedirectUrl(redirectPath: string | null): string {
  if (!redirectPath || redirectPath === 'null') {
    return '/dashboard'
  }
  
  try {
    // Decode the redirect path
    const decodedPath = decodeURIComponent(redirectPath)
    
    // Check if it's a valid internal path
    const isValidPath = ALLOWED_REDIRECT_PATHS.some(allowedPath => 
      decodedPath === allowedPath || decodedPath.startsWith(allowedPath + '/')
    )
    
    if (isValidPath) {
      return decodedPath
    }
    
    console.warn('Invalid redirect path attempted:', decodedPath)
    return '/dashboard'
  } catch (error) {
    console.warn('Failed to decode redirect path:', redirectPath)
    return '/dashboard'
  }
}

// Sanitize string to prevent XSS
function sanitizeString(str: string | undefined): string | undefined {
  if (!str) return undefined
  return str.replace(/[<>'"&]/g, '').trim().substring(0, 100)
}

// Validate and sanitize user metadata
function validateUserMetadata(metadata: any): { name?: string; picture_url?: string } {
  try {
    const validatedMetadata = userMetadataSchema.parse(metadata || {})
    
    const name = sanitizeString(
      validatedMetadata.full_name || 
      validatedMetadata.name || 
      undefined
    )
    
    const picture_url = validatedMetadata.picture || validatedMetadata.avatar_url
    
    return {
      name: name || undefined,
      picture_url: picture_url || undefined
    }
  } catch (error) {
    console.warn('Invalid user metadata provided, using defaults')
    return {}
  }
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const state = requestUrl.searchParams.get('state')
  const error = requestUrl.searchParams.get('error')
  const error_description = requestUrl.searchParams.get('error_description')
  const token_hash = requestUrl.searchParams.get('token_hash')
  const type = requestUrl.searchParams.get('type')

  if (error) {
    console.error('OAuth error:', error, error_description)
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error_description || error)}`, requestUrl.origin)
    )
  }

  // Handle email verification - but codes are entered in the verify page, not callback
  // Remove this block since we're using code-based verification

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
        console.log('Auth successful for user:', data.user.id)
        console.log('Session established:', !!data.session)
        console.log('Email confirmed:', data.user.email_confirmed_at ? 'Yes' : 'No')

        // For regular signup (not OAuth), check if email verification is required
        if (!data.user.email_confirmed_at && !data.user.app_metadata?.provider) {
          console.log('Email not verified for regular signup, redirecting to verification page')
          return NextResponse.redirect(
            new URL(`/verify-email?email=${encodeURIComponent(data.user.email || '')}`, requestUrl.origin)
          )
        }
        
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
        
        // Validate email
        let validatedEmail: string
        try {
          validatedEmail = emailSchema.parse(data.user.email)
        } catch (error) {
          console.error('Invalid email from OAuth provider')
          return NextResponse.redirect(
            new URL(`/login?error=${encodeURIComponent('Invalid email from OAuth provider')}`, requestUrl.origin)
          )
        }
        
        // Validate and sanitize user metadata
        const { name, picture_url } = validateUserMetadata(data.user.user_metadata)
        
        // Generate fallback name from email if no valid name provided
        const safeName = name || sanitizeString(validatedEmail.split('@')[0]) || 'User'
        
        const { data: profile, error: upsertError } = await supabase
          .from('profiles')
          .upsert({
            id: data.user.id,
            email: validatedEmail,
            name: safeName,
            picture_url: picture_url,
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
          // Profile exists - for now, always send new OAuth users to onboarding
          // This ensures they can create their organization
          if (profile.first_time) {
            console.log('New user (first_time=true) - redirecting to onboarding');
            finalRedirect = '/onboarding';
          } else {
            // Existing user - allow dashboard access
            console.log('Existing user (first_time=false) - allowing dashboard access');
            finalRedirect = validateRedirectUrl(state);
          }
          
          // Optional: Check organizations (commented out since table may not exist yet)
          /*
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
              finalRedirect = validateRedirectUrl(state);
            }
          } catch (orgCheckError) {
            console.error('Exception during organization check:', orgCheckError);
            // On any error, send to onboarding to be safe
            console.log('Organization check failed - redirecting to onboarding');
            finalRedirect = '/onboarding';
          }
          */
        }
        
        console.log('OAuth callback complete - redirecting to:', finalRedirect);
        
        // Add a small delay to ensure all async operations complete
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Create redirect response with all the cookies from the previous response
        const redirectResponse = NextResponse.redirect(new URL(finalRedirect, requestUrl.origin))
        
        // Securely copy auth cookies with proper security flags
        response.cookies.getAll().forEach((cookie) => {
          // Only copy Supabase auth cookies
          if (cookie.name.startsWith('sb-') || cookie.name.includes('auth')) {
            redirectResponse.cookies.set({
              name: cookie.name,
              value: cookie.value,
              httpOnly: true,
              secure: process.env.NODE_ENV === 'production',
              sameSite: 'lax',
              path: '/',
              maxAge: 60 * 60 * 24 * 7 // 7 days
            })
          }
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