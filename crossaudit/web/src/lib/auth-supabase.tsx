"use client";
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User as SupabaseUser, AuthError, Session } from '@supabase/supabase-js';
import { createClientComponentClient, Database } from './supabase-client';

// Extended user type with profile data
export interface User {
  id: string;
  email: string;
  name?: string;
  pictureUrl?: string;
  mfaEnabled: boolean;
  firstTime: boolean;
  createdAt: string;
  organizations: UserOrganization[];
}

export interface UserOrganization {
  id: string;
  name: string;
  role: 'owner' | 'admin' | 'member';
  tier: 'free' | 'pro' | 'enterprise';
}

interface AuthState {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
}

interface AuthContextValue extends AuthState {
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signIn: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  signInWithOAuth: (provider: 'google' | 'github' | 'azure') => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  updateProfile: (updates: Partial<Database['public']['Tables']['profiles']['Update']>) => Promise<void>;
  refreshSession: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    isLoading: true,
    isAuthenticated: false,
    error: null,
  });

  const supabase = createClientComponentClient();

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  const setError = useCallback((error: string) => {
    setState(prev => ({ ...prev, error, isLoading: false }));
  }, []);

  const setLoading = useCallback((isLoading: boolean) => {
    setState(prev => ({ ...prev, isLoading }));
  }, []);

  // Fetch user profile and organizations
  const fetchUserProfile = useCallback(async (supabaseUser: SupabaseUser): Promise<User | null> => {
    try {
      // Get user profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', supabaseUser.id)
        .single();

      if (profileError) {
        console.error('Error fetching profile:', profileError);
        // For OAuth users, create a basic profile if it doesn't exist
        if (profileError.code === 'PGRST116') { // Row not found
          console.log('Profile not found, creating basic profile for OAuth user');
          const { data: newProfile, error: createError } = await supabase
            .from('profiles')
            .insert({
              id: supabaseUser.id,
              email: supabaseUser.email,
              name: supabaseUser.user_metadata?.full_name || supabaseUser.user_metadata?.name,
              picture_url: supabaseUser.user_metadata?.avatar_url || supabaseUser.user_metadata?.picture,
              first_time: true,
              mfa_enabled: false
            })
            .select('*')
            .single();
          
          if (createError) {
            console.error('Error creating profile in auth provider:', createError);
            return null;
          }
          
          // Use the newly created profile
          profile = newProfile;
        } else {
          return null;
        }
      }

      // Get user organizations
      const { data: userOrgs, error: orgsError } = await supabase
        .from('user_organizations')
        .select(`
          role,
          organizations!inner(
            id,
            name,
            tier
          )
        `)
        .eq('user_id', supabaseUser.id);

      if (orgsError) {
        console.error('Error fetching organizations:', orgsError);
        // Continue without organizations - OAuth users might not have orgs initially
      }

      const organizations: UserOrganization[] = (userOrgs || []).map((item: any) => ({
        id: item.organizations.id,
        name: item.organizations.name,
        role: item.role as 'owner' | 'admin' | 'member',
        tier: item.organizations.tier as 'free' | 'pro' | 'enterprise',
      }));

      return {
        id: supabaseUser.id,
        email: supabaseUser.email || '',
        name: profile.name || undefined,
        pictureUrl: profile.picture_url || undefined,
        mfaEnabled: profile.mfa_enabled || false,
        firstTime: profile.first_time || false,
        createdAt: profile.created_at,
        organizations,
      };
    } catch (error) {
      console.error('Error in fetchUserProfile:', error);
      return null;
    }
  }, [supabase]);

  // Set user and session
  const setUserAndSession = useCallback(async (session: Session | null) => {
    if (session?.user) {
      console.log('Setting user and session for:', session.user.id);
      const userProfile = await fetchUserProfile(session.user);
      console.log('Fetched user profile:', userProfile);
      setState(prev => ({
        ...prev,
        user: userProfile,
        session,
        isAuthenticated: !!userProfile,
        isLoading: false,
        error: null,
      }));
      console.log('Auth state updated - isAuthenticated:', !!userProfile);
    } else {
      setState(prev => ({
        ...prev,
        user: null,
        session: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      }));
    }
  }, [fetchUserProfile]);

  // Initialize auth state
  useEffect(() => {
    let mounted = true;

    // Get initial session
    const getInitialSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Error getting session:', error);
          if (mounted) {
            setState(prev => ({ ...prev, isLoading: false, error: error.message }));
          }
          return;
        }

        if (mounted) {
          await setUserAndSession(session);
        }
      } catch (error) {
        console.error('Error in getInitialSession:', error);
        if (mounted) {
          setState(prev => ({ ...prev, isLoading: false, error: 'Failed to initialize auth' }));
        }
      }
    };

    getInitialSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;

        console.log('Auth state changed:', event, session?.user?.id);

        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          await setUserAndSession(session);
        } else if (event === 'SIGNED_OUT') {
          setState(prev => ({
            ...prev,
            user: null,
            session: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,
          }));
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase.auth, setUserAndSession]);

  // Sign up with email and password
  const signUp = useCallback(async (email: string, password: string, name: string) => {
    setLoading(true);
    clearError();

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
          },
        },
      });

      if (error) {
        throw error;
      }

      // Note: User will need to verify email before they can sign in
      setState(prev => ({ ...prev, isLoading: false }));
    } catch (error) {
      const message = error instanceof AuthError ? error.message : 'Sign up failed';
      setError(message);
      throw error;
    }
  }, [supabase.auth, setLoading, clearError, setError]);

  // Sign in with email and password
  const signIn = useCallback(async (email: string, password: string, rememberMe = false) => {
    setLoading(true);
    clearError();

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw error;
      }

      // Log authentication event
      if (data.user) {
        await supabase.rpc('log_auth_event', {
          p_user_id: data.user.id,
          p_action: 'login_success',
          p_metadata: { remember_me: rememberMe },
        });
      }

      // Session will be handled by onAuthStateChange
    } catch (error) {
      const message = error instanceof AuthError ? error.message : 'Sign in failed';
      setError(message);
      
      // Log failed login attempt
      await supabase.rpc('log_auth_event', {
        p_user_id: null,
        p_action: 'login_failure',
        p_metadata: { email, error: message },
      });
      
      throw error;
    }
  }, [supabase.auth, supabase, setLoading, clearError, setError]);

  // Sign in with OAuth
  const signInWithOAuth = useCallback(async (provider: 'google' | 'github' | 'azure') => {
    setLoading(true);
    clearError();

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        throw error;
      }

      // OAuth redirect will happen, so we don't set loading to false here
    } catch (error) {
      const message = error instanceof AuthError ? error.message : 'OAuth sign in failed';
      setError(message);
      throw error;
    }
  }, [supabase.auth, setLoading, clearError, setError]);

  // Sign out
  const signOut = useCallback(async () => {
    setLoading(true);

    try {
      // Log logout event
      if (state.user) {
        await supabase.rpc('log_auth_event', {
          p_user_id: state.user.id,
          p_action: 'logout',
        });
      }

      const { error } = await supabase.auth.signOut();

      if (error) {
        throw error;
      }

      // Session will be handled by onAuthStateChange
    } catch (error) {
      console.error('Error signing out:', error);
      // Continue with logout even if logging fails
      setState(prev => ({
        ...prev,
        user: null,
        session: null,
        isAuthenticated: false,
        isLoading: false,
      }));
    }
  }, [supabase.auth, supabase, state.user, setLoading]);

  // Reset password
  const resetPassword = useCallback(async (email: string) => {
    clearError();

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        throw error;
      }
    } catch (error) {
      const message = error instanceof AuthError ? error.message : 'Password reset failed';
      setError(message);
      throw error;
    }
  }, [supabase.auth, clearError, setError]);

  // Update password
  const updatePassword = useCallback(async (password: string) => {
    setLoading(true);
    clearError();

    try {
      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error) {
        throw error;
      }

      setState(prev => ({ ...prev, isLoading: false }));
    } catch (error) {
      const message = error instanceof AuthError ? error.message : 'Password update failed';
      setError(message);
      throw error;
    }
  }, [supabase.auth, setLoading, clearError, setError]);

  // Update profile
  const updateProfile = useCallback(async (updates: Partial<Database['public']['Tables']['profiles']['Update']>) => {
    if (!state.user) {
      throw new Error('User not authenticated');
    }

    setLoading(true);
    clearError();

    try {
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', state.user.id);

      if (error) {
        throw error;
      }

      // Refresh user profile
      if (state.session) {
        await setUserAndSession(state.session);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Profile update failed';
      setError(message);
      throw error;
    }
  }, [supabase, state.user, state.session, setLoading, clearError, setError, setUserAndSession]);

  // Refresh session
  const refreshSession = useCallback(async () => {
    try {
      const { data, error } = await supabase.auth.refreshSession();
      
      if (error) {
        throw error;
      }

      if (data.session) {
        await setUserAndSession(data.session);
      }
    } catch (error) {
      console.error('Error refreshing session:', error);
      // If refresh fails, sign out
      await signOut();
    }
  }, [supabase.auth, setUserAndSession, signOut]);

  const value: AuthContextValue = {
    ...state,
    signUp,
    signIn,
    signInWithOAuth,
    signOut,
    resetPassword,
    updatePassword,
    updateProfile,
    refreshSession,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}