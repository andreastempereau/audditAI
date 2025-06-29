import { createClient } from '@supabase/supabase-js'
import { createBrowserClient } from '@supabase/ssr'

// Types for our database schema
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          name: string | null
          email: string | null
          picture_url: string | null
          first_time: boolean
          mfa_enabled: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          name?: string | null
          email?: string | null
          picture_url?: string | null
          first_time?: boolean
          mfa_enabled?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string | null
          email?: string | null
          picture_url?: string | null
          first_time?: boolean
          mfa_enabled?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      organizations: {
        Row: {
          id: string
          name: string
          tier: string
          owner_id: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          tier?: string
          owner_id: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          tier?: string
          owner_id?: string
          created_at?: string
          updated_at?: string
        }
      }
      user_organizations: {
        Row: {
          user_id: string
          org_id: string
          role: string
          created_at: string
        }
        Insert: {
          user_id: string
          org_id: string
          role?: string
          created_at?: string
        }
        Update: {
          user_id?: string
          org_id?: string
          role?: string
          created_at?: string
        }
      }
      organization_invitations: {
        Row: {
          id: string
          email: string
          organization_id: string
          invited_by: string
          expires_at: string
          used: boolean
          created_at: string
        }
        Insert: {
          id?: string
          email: string
          organization_id: string
          invited_by: string
          expires_at: string
          used?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          email?: string
          organization_id?: string
          invited_by?: string
          expires_at?: string
          used?: boolean
          created_at?: string
        }
      }
      audit_log_auth: {
        Row: {
          id: string
          user_id: string | null
          action: string
          metadata: any
          ip_address: string | null
          user_agent: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          action: string
          metadata?: any
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          action?: string
          metadata?: any
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      log_auth_event: {
        Args: {
          p_user_id: string | null
          p_action: string
          p_metadata?: any
        }
        Returns: void
      }
    }
    Enums: {
      [_ in never]: never
    }
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to your .env.local file.')
}

// Client-side Supabase client for browser usage
export const createClientComponentClient = () => {
  return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey)
}

// Simple client for non-authenticated operations
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)