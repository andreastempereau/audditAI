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
  loadingStage: 'idle' | 'initializing' | 'fetching-session' | 'fetching-profile' | 'ready';
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

// Profile fetch cache to prevent duplicate requests
const profileFetchCache = new Map<string, Promise<User | null>>();

export function AuthProvider({ children }: AuthProviderProps) {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    isLoading: true,
    isAuthenticated: false,
    error: null,
    loadingStage: 'initializing',
  });

  const supabase = createClientComponentClient();
  const abortControllerRef = React.useRef<AbortController | null>(null);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  const setError = useCallback((error: string) => {
    setState(prev => ({ ...prev, error, isLoading: false }));
  }, []);

  const setLoading = useCallback((isLoading: boolean, stage?: AuthState['loadingStage']) => {
    setState(prev => ({ 
      ...prev, 
      isLoading, 
      loadingStage: stage || (isLoading ? prev.loadingStage : 'idle')
    }));
  }, []);

  // Internal fetch user profile function
  const fetchUserProfileInternal = useCallback(async (supabaseUser: SupabaseUser, retryCount = 0, isOAuthCallback = false, signal?: AbortSignal): Promise<User | null> => {
    console.log('fetchUserProfileInternal called for user:', supabaseUser.id, 'retry:', retryCount, 'isOAuth:', isOAuthCallback);
    
    try {
      // Check if request was aborted
      if (signal?.aborted) {
        console.log('Profile fetch aborted');
        return null;
      }
      // No artificial delays - rely on proper server-side handling

      // Get user profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', supabaseUser.id)
        .single();

      console.log('Profile lookup result:', { profile, profileError });

      if (profileError || !profile) {
        // For OAuth users, retry with exponential backoff since profile creation might be in progress
        // For regular email/password logins, only retry once quickly since profile should exist
        const maxRetries = isOAuthCallback ? 5 : 1;
        const baseDelay = isOAuthCallback ? 1000 : 500;
        
        if (profileError?.code === 'PGRST116' && retryCount < maxRetries) {
          const delay = isOAuthCallback ? 
            Math.min(baseDelay * Math.pow(2, retryCount), 8000) : // OAuth: exponential backoff up to 8s
            baseDelay; // Email/password: quick 500ms retry only
          console.log(`Profile not found, retrying in ${delay}ms... (attempt ${retryCount + 1}/${maxRetries}, isOAuth: ${isOAuthCallback})`);
          
          // Check if aborted before delay
          if (signal?.aborted) return null;
          
          await new Promise((resolve, reject) => {
            const timeout = setTimeout(resolve, delay);
            signal?.addEventListener('abort', () => {
              clearTimeout(timeout);
              reject(new Error('Aborted'));
            });
          }).catch(() => null);
          
          if (signal?.aborted) return null;
          
          return fetchUserProfileInternal(supabaseUser, retryCount + 1, isOAuthCallback, signal);
        }
        
        console.error('Error fetching profile or profile not found after retries:', profileError);
        
        // For OAuth users, try to create profile via upsert if all retries failed
        if (profileError?.code === 'PGRST116' && supabaseUser.app_metadata?.provider) {
          console.log('Attempting to create profile for OAuth user after retries failed');
          try {
            const { data: newProfile, error: upsertError } = await supabase
              .from('profiles')
              .upsert({
                id: supabaseUser.id,
                email: supabaseUser.email,
                name: supabaseUser.user_metadata?.full_name || supabaseUser.user_metadata?.name || supabaseUser.email?.split('@')[0],
                picture_url: supabaseUser.user_metadata?.picture || supabaseUser.user_metadata?.avatar_url,
                first_time: true,
                mfa_enabled: false,
                updated_at: new Date().toISOString()
              }, {
                onConflict: 'id',
                ignoreDuplicates: false
              })
              .select()
              .single();

            if (upsertError) {
              console.error('Client-side profile upsert failed:', upsertError);
              // Return minimal profile to allow user to continue
              return {
                id: supabaseUser.id,
                email: supabaseUser.email || '',
                name: supabaseUser.user_metadata?.full_name || supabaseUser.user_metadata?.name || supabaseUser.email?.split('@')[0] || '',
                pictureUrl: supabaseUser.user_metadata?.picture || supabaseUser.user_metadata?.avatar_url || undefined,
                mfaEnabled: false,
                firstTime: true,
                createdAt: new Date().toISOString(),
                organizations: [],
              };
            } else {
              console.log('Client-side profile created successfully:', newProfile);
              return {
                id: supabaseUser.id,
                email: supabaseUser.email || '',
                name: newProfile.name || undefined,
                pictureUrl: newProfile.picture_url || undefined,
                mfaEnabled: newProfile.mfa_enabled || false,
                firstTime: newProfile.first_time || false,
                createdAt: newProfile.created_at,
                organizations: [],
              };
            }
          } catch (createError) {
            console.error('Error creating profile on client:', createError);
            // Return minimal profile as last resort
            return {
              id: supabaseUser.id,
              email: supabaseUser.email || '',
              name: supabaseUser.user_metadata?.full_name || supabaseUser.user_metadata?.name || supabaseUser.email?.split('@')[0] || '',
              pictureUrl: supabaseUser.user_metadata?.picture || supabaseUser.user_metadata?.avatar_url || undefined,
              mfaEnabled: false,
              firstTime: true,
              createdAt: new Date().toISOString(),
              organizations: [],
            };
          }
        }
        
        return null;
      }

      // Return user profile without organizations (loaded separately)
      const userProfile = {
        id: supabaseUser.id,
        email: supabaseUser.email || '',
        name: profile.name || undefined,
        pictureUrl: profile.picture_url || undefined,
        mfaEnabled: profile.mfa_enabled || false,
        firstTime: profile.first_time || false,
        createdAt: profile.created_at,
        organizations: [], // Always empty to avoid RLS issues
      };

      console.log('Returning user profile:', userProfile);
      return userProfile;
    } catch (error) {
      console.error('Error in fetchUserProfile:', error);
      return null;
    }
  }, [supabase]);

  // Deduplicated fetch user profile function
  const fetchUserProfile = useCallback(async (supabaseUser: SupabaseUser, retryCount = 0, isOAuthCallback = false): Promise<User | null> => {
    const cacheKey = supabaseUser.id;
    
    // Return existing promise if one is in flight
    if (profileFetchCache.has(cacheKey)) {
      console.log('Returning cached profile fetch promise for user:', cacheKey);
      return profileFetchCache.get(cacheKey)!;
    }
    
    // Create new promise with abort controller
    const controller = new AbortController();
    abortControllerRef.current = controller;
    
    const promise = fetchUserProfileInternal(supabaseUser, retryCount, isOAuthCallback, controller.signal);
    profileFetchCache.set(cacheKey, promise);
    
    try {
      const result = await promise;
      return result;
    } finally {
      // Clean up cache after a short delay to handle rapid successive calls
      setTimeout(() => profileFetchCache.delete(cacheKey), 100);
    }
  }, [fetchUserProfileInternal]);

  // Set user and session
  const setUserAndSession = useCallback(async (session: Session | null, isOAuthCallback = false) => {
    try {
      if (session?.user) {
        console.log('Setting user and session for:', session.user.id, 'isOAuth:', isOAuthCallback);
        setLoading(true, 'fetching-profile');
        
        // Fetch user profile with OAuth context
        const userProfile = await fetchUserProfile(session.user, 0, isOAuthCallback);
        console.log('Fetched user profile:', userProfile);
        
        if (userProfile) {
          setState(prev => ({
            ...prev,
            user: userProfile,
            session,
            isAuthenticated: true,
            isLoading: false,
            loadingStage: 'ready',
            error: null,
          }));
          console.log('Auth state updated - authenticated with profile');
        } else {
          // User has session but no profile - still consider them authenticated
          console.log('User has session but no profile - considering authenticated');
          setState(prev => ({
            ...prev,
            user: null,
            session,
            isAuthenticated: true, // They have a valid session
            isLoading: false,
            loadingStage: 'ready',
            error: 'Profile not found - please complete setup',
          }));
        }
      } else {
        console.log('No session - user not authenticated');
        setState(prev => ({
          ...prev,
          user: null,
          session: null,
          isAuthenticated: false,
          isLoading: false,
          loadingStage: 'ready',
          error: null,
        }));
      }
    } catch (error) {
      console.error('Error in setUserAndSession:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        loadingStage: 'ready',
        error: 'Failed to initialize authentication',
      }));
    }
  }, [fetchUserProfile]);

  // Initialize auth state
  useEffect(() => {
    const controller = new AbortController();
    abortControllerRef.current = controller;

    // Get initial session
    const getInitialSession = async () => {
      try {
        setLoading(true, 'fetching-session');
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (controller.signal.aborted) return;
        
        if (error) {
          console.error('Error getting session:', error);
          setState(prev => ({ 
            ...prev, 
            isLoading: false, 
            loadingStage: 'ready',
            error: error.message 
          }));
          return;
        }

        // Check if this is an OAuth callback by looking at URL only
        const isOAuthCallback = typeof window !== 'undefined' && 
          window.location.search.includes('code=');
        await setUserAndSession(session, isOAuthCallback);
      } catch (error) {
        console.error('Error in getInitialSession:', error);
        if (!controller.signal.aborted) {
          setState(prev => ({ 
            ...prev, 
            isLoading: false, 
            loadingStage: 'ready',
            error: 'Failed to initialize auth' 
          }));
        }
      }
    };

    getInitialSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (controller.signal.aborted) return;

        console.log('Auth state changed:', event, session?.user?.id);

        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          // Check if this is an OAuth sign-in by looking at the URL only
          const isOAuthCallback = event === 'SIGNED_IN' && 
            typeof window !== 'undefined' && window.location.search.includes('code=');
          await setUserAndSession(session, isOAuthCallback);
        } else if (event === 'SIGNED_OUT') {
          setState(prev => ({
            ...prev,
            user: null,
            session: null,
            isAuthenticated: false,
            isLoading: false,
            loadingStage: 'ready',
            error: null,
          }));
        }
      }
    );

    return () => {
      controller.abort();
      subscription.unsubscribe();
      // Clear any pending profile fetches
      profileFetchCache.clear();
    };
  }, [supabase.auth, setUserAndSession]);

  // Sign up with email and password
  const signUp = useCallback(async (email: string, password: string, name: string) => {
    setLoading(true);
    clearError();

    try {
      // Store signup data in session storage temporarily
      sessionStorage.setItem('pendingSignup', JSON.stringify({ email, password, name }));
      
      // Send OTP to verify email first
      console.log('Sending OTP for email verification');
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: email,
        options: {
          shouldCreateUser: false,
          data: {
            signup_intent: true,
            name: name
          }
        }
      });

      if (otpError) {
        throw otpError;
      }

      // OTP sent successfully
      setState(prev => ({ ...prev, isLoading: false }));
    } catch (error) {
      const message = error instanceof AuthError ? error.message : 'Sign up failed';
      setError(message);
      throw error;
    }
  }, [supabase.auth, setLoading, clearError, setError]);

  // Sign in with email and password
  const signIn = useCallback(async (email: string, password: string, rememberMe = false) => {
    console.log('=== AUTH CONTEXT signIn START ===');
    console.log('signIn called with:', { email, rememberMe });
    clearError();

    try {
      // Don't set loading here - let the form handle its own loading state
      console.log('About to call supabase.auth.signInWithPassword...');
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      console.log('signInWithPassword completed with result:', { 
        hasUser: !!data.user, 
        userId: data.user?.id,
        hasSession: !!data.session,
        error: error?.message 
      });

      if (error) {
        console.error('Supabase signIn error:', error);
        throw error;
      }

      console.log('Sign in successful, user:', data.user?.id);
      
      // Immediately update state with the session data to prevent redirect issues
      if (data.session && data.user) {
        console.log('Immediately setting user and session after sign in');
        await setUserAndSession(data.session, false);
      }
      
      console.log('=== AUTH CONTEXT signIn SUCCESS END ===');
      
    } catch (error) {
      console.error('signIn error caught in catch block:', error);
      const message = error instanceof AuthError ? error.message : 'Sign in failed';
      setError(message);
      console.log('=== AUTH CONTEXT signIn ERROR END ===');
      throw error;
    }
  }, [supabase.auth, clearError, setError]);

  // Sign in with OAuth
  const signInWithOAuth = useCallback(async (provider: 'google' | 'github' | 'azure') => {
    setLoading(true);
    clearError();

    try {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
      const redirectTo = `${siteUrl}/auth/callback`;
      console.log('OAuth redirect URL:', redirectTo);
      
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo,
        },
      });

      if (error) {
        throw error;
      }

      // OAuth redirect will happen, so we don't set loading to false here
    } catch (error) {
      const message = error instanceof AuthError ? error.message : 'OAuth sign in failed';
      setError(message);
      setLoading(false);
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
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${siteUrl}/reset-password`,
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

      // Immediately update the local user state with the changes
      setState(prev => ({
        ...prev,
        user: prev.user ? { ...prev.user, firstTime: updates.first_time ?? prev.user.firstTime } : null,
        isLoading: false
      }));

      // Also refresh user profile from database
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