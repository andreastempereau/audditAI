"use client";
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, endpoints } from './api';
import { TokenManager } from './tokens';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  verifyEmail: (code: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  children: React.ReactNode;
}


export function AuthProvider({ children }: AuthProviderProps) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
    error: null,
  });

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  const setLoading = useCallback((isLoading: boolean) => {
    setState(prev => ({ ...prev, isLoading }));
  }, []);

  const setError = useCallback((error: string) => {
    setState(prev => ({ ...prev, error, isLoading: false }));
  }, []);

  const setUser = useCallback((user: User | null) => {
    setState(prev => ({
      ...prev,
      user,
      isAuthenticated: !!user,
      isLoading: false,
      error: null,
    }));
  }, []);

  // Initialize authentication state
  useEffect(() => {
    const initAuth = async () => {
      const token = TokenManager.getAccessToken();
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const user = await endpoints.me();
        setUser(user);
      } catch (error) {
        // Try to refresh token
        try {
          await TokenManager.refreshAccessToken();
          const user = await endpoints.me();
          setUser(user);
        } catch (refreshError) {
          TokenManager.clearTokens();
          setLoading(false);
        }
      }
    };

    initAuth();
  }, [setUser, setLoading]);

  const login = useCallback(async (email: string, password: string, rememberMe = false) => {
    setLoading(true);
    clearError();

    try {
      const response = await endpoints.login({ email, password, rememberMe });
      TokenManager.setAccessToken(response.accessToken);
      TokenManager.setRefreshToken(response.refreshToken);
      setUser(response.user);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Login failed';
      setError(message);
      throw error;
    }
  }, [setLoading, setError, setUser, clearError]);

  const register = useCallback(async (email: string, password: string, name: string) => {
    setLoading(true);
    clearError();

    try {
      await endpoints.register({ email, password, name });
      setState(prev => ({ ...prev, isLoading: false }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Registration failed';
      setError(message);
      throw error;
    }
  }, [setLoading, setError, clearError]);

  const verifyEmail = useCallback(async (code: string) => {
    setLoading(true);
    clearError();

    try {
      const response = await endpoints.verifyEmail({ code });
      TokenManager.setAccessToken(response.accessToken);
      TokenManager.setRefreshToken(response.refreshToken);
      setUser(response.user);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Email verification failed';
      setError(message);
      throw error;
    }
  }, [setLoading, setError, setUser, clearError]);

  const logout = useCallback(async () => {
    setLoading(true);
    
    try {
      const refreshToken = TokenManager.getRefreshToken();
      if (refreshToken) {
        await endpoints.logout({ refreshToken });
      }
    } catch (error) {
      // Continue with logout even if backend call fails
      console.warn('Logout API call failed:', error);
    } finally {
      TokenManager.clearTokens();
      setUser(null);
    }
  }, [setLoading, setUser]);

  const refreshToken = useCallback(async () => {
    try {
      await TokenManager.refreshAccessToken();
      const user = await endpoints.me();
      setUser(user);
    } catch (error) {
      TokenManager.clearTokens();
      setUser(null);
      throw error;
    }
  }, [setUser]);

  const value: AuthContextValue = {
    ...state,
    login,
    register,
    verifyEmail,
    logout,
    refreshToken,
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

// Re-export TokenManager for convenience
export { TokenManager };
