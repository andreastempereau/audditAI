"use client";
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { OnboardingWizard } from '@/components/auth/OnboardingWizard';
import { useAuth } from '@/lib/auth-supabase';

export default function OnboardingPage() {
  const router = useRouter();
  const { updateProfile, user, isLoading, isAuthenticated, error } = useAuth();
  const [loadingTimeout, setLoadingTimeout] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Debug authentication state
  useEffect(() => {
    console.log('Onboarding page auth state:', {
      user,
      isLoading,
      isAuthenticated,
      error,
    });
  }, [user, isLoading, isAuthenticated, error]);

  // Set a timeout for loading state - longer for OAuth
  useEffect(() => {
    const isOAuthFlow = typeof window !== 'undefined' && 
      (window.location.search.includes('code=') || 
       window.location.href.includes('/onboarding'));
    
    const timeout = isOAuthFlow ? 30000 : 15000; // 30s for OAuth, 15s for regular
    
    const timer = setTimeout(() => {
      if (isLoading) {
        console.log('Auth loading timeout reached');
        setLoadingTimeout(true);
        setAuthError(
          isOAuthFlow 
            ? 'OAuth authentication is taking longer than expected. The profile may still be creating.'
            : 'Authentication is taking longer than expected. This might be due to profile creation issues.'
        );
      }
    }, timeout);

    return () => clearTimeout(timer);
  }, [isLoading]);

  // Redirect if not authenticated (but be more lenient for OAuth flows)
  useEffect(() => {
    const isOAuthFlow = typeof window !== 'undefined' && window.location.search.includes('code=');
    const isDirectOnboardingAccess = typeof window !== 'undefined' && 
      window.location.pathname === '/onboarding' && !window.location.search.includes('code=');
    
    // Don't redirect immediately for OAuth flows or if coming from auth callback
    if (!isLoading && !isAuthenticated && !isOAuthFlow && isDirectOnboardingAccess) {
      console.log('User not authenticated, redirecting to login');
      router.push('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  // Show loading while checking auth
  if (isLoading && !loadingTimeout) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="text-sm text-muted-600">Loading your profile...</p>
        </div>
      </div>
    );
  }

  // If loading timeout reached, show error and redirect option
  if (loadingTimeout) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center max-w-md px-6">
          <div className="text-red-500">
            <svg className="w-12 h-12 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 6.5c-.77.833-.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900">Setup Taking Too Long</h3>
          <p className="text-sm text-muted-600">{authError || 'Authentication is taking longer than expected.'}</p>
          <div className="flex gap-3">
            <button
              onClick={() => {
                console.log('Manually redirecting to login');
                router.push('/login');
              }}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/80 transition-colors"
            >
              Return to Login
            </button>
            <button
              onClick={() => {
                console.log('Forcing refresh of auth state');
                window.location.reload();
              }}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Don't render if not authenticated
  if (!isAuthenticated) {
    console.log('Onboarding: User not authenticated, redirecting to login');
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <p className="text-sm text-muted-600">Authentication required...</p>
        </div>
      </div>
    );
  }

  // If authenticated but no user profile, show onboarding wizard
  if (isAuthenticated && !user && !isLoading) {
    console.log('User authenticated but no profile - showing onboarding wizard');
    // This is normal for OAuth users - their profile might still be loading
    // Show the onboarding wizard anyway since they have a valid session
  }

  const handleOnboardingComplete = async () => {
    try {
      // Only update profile if user exists
      if (user) {
        await updateProfile({ first_time: false });
      }
      
      // Redirect to app
      router.push('/app');
    } catch (error) {
      console.error('Error completing onboarding:', error);
      // Still redirect to app even if profile update fails
      router.push('/app');
    }
  };

  // Show onboarding wizard if authenticated (with or without user profile)
  // For OAuth users, we might not have the user profile immediately
  const isOAuthFlow = typeof window !== 'undefined' && window.location.search.includes('code=');
  
  if (isAuthenticated || (!isLoading && isOAuthFlow)) {
    return (
      <OnboardingWizard
        isOpen={true}
        onComplete={handleOnboardingComplete}
        user={user} // Pass user to wizard for better handling
      />
    );
  }

  // If not authenticated and not loading, should have been redirected already
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <p className="text-sm text-muted-600">Redirecting to login...</p>
      </div>
    </div>
  );
}