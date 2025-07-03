import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { type Database } from './supabase-client'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to your .env.local file.')
}

// Server-side Supabase client for Server Components
export const createServerComponentClient = () => {
  const cookieStore = cookies()
  
  return createServerClient<Database>(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
      },
    }
  )
}

// Server-side Supabase client for Route Handlers
export const createRouteHandlerClient = (request: Request) => {
  return createServerClient<Database>(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        get(name: string) {
          const cookie = request.headers.get('cookie')
          const match = cookie?.match(new RegExp(`${name}=([^;]+)`))
          return match?.[1]
        },
        set(name: string, value: string, options: any) {
          // Set cookie logic for route handlers
        },
        remove(name: string, options: any) {
          // Remove cookie logic for route handlers  
        },
      },
    }
  )
}