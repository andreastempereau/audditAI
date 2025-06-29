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

  // Set a timeout for loading state
  useEffect(() => {
    const timer = setTimeout(() => {
      if (isLoading) {
        console.log('Auth loading timeout reached');
        setLoadingTimeout(true);
        setAuthError('Authentication is taking longer than expected. This might be due to profile creation issues.');
      }
    }, 8000); // 8 second timeout (reduced from 10)

    return () => clearTimeout(timer);
  }, [isLoading]);

  // Redirect if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
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

  // If authenticated but no user profile, show a helpful message
  if (isAuthenticated && !user && !isLoading) {
    console.log('User authenticated but no profile - proceeding with onboarding');
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center max-w-md px-6">
          <div className="text-blue-500">
            <svg className="w-12 h-12 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900">Setting Up Your Profile</h3>
          <p className="text-sm text-muted-600">
            You're authenticated but your profile is still being created. This is normal for new accounts.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/80 transition-colors"
            >
              Refresh Page
            </button>
            <button
              onClick={() => router.push('/login')}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Back to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleOnboardingComplete = async () => {
    try {
      // Mark user as no longer first-time
      await updateProfile({ first_time: false });
      
      // Redirect to main app
      router.push('/app');
    } catch (error) {
      console.error('Error completing onboarding:', error);
      // Still redirect to app even if profile update fails
      router.push('/app');
    }
  };

  return (
    <OnboardingWizard
      isOpen={true}
      onComplete={handleOnboardingComplete}
    />
  );
}