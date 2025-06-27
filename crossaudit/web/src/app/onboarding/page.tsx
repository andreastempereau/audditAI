"use client";
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { OnboardingWizard } from '@/components/auth/OnboardingWizard';
import { useAuth } from '@/lib/auth-supabase';

export default function OnboardingPage() {
  const router = useRouter();
  const { updateProfile, user, isLoading, isAuthenticated } = useAuth();

  // Debug authentication state
  useEffect(() => {
    console.log('Onboarding page auth state:', {
      user,
      isLoading,
      isAuthenticated,
    });
  }, [user, isLoading, isAuthenticated]);

  // Redirect if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      console.log('User not authenticated, redirecting to login');
      router.push('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  // Show loading while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Don't render if not authenticated
  if (!isAuthenticated || !user) {
    return null;
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