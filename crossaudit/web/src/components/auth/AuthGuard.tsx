"use client";
import React, { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-supabase';
import { OnboardingWizard } from './OnboardingWizard';

interface AuthGuardProps {
  children: React.ReactNode;
  requireAuth?: boolean;
  redirectTo?: string;
}

export function AuthGuard({ 
  children, 
  requireAuth = true, 
  redirectTo = '/login' 
}: AuthGuardProps) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (isLoading) return; // Wait for auth state to load

    if (requireAuth && !isAuthenticated) {
      // Redirect to login with current path as return URL
      const returnUrl = encodeURIComponent(pathname || '/app');
      router.push(`${redirectTo}?redirect=${returnUrl}`);
      return;
    }

    if (!requireAuth && isAuthenticated) {
      // User is authenticated but on a public route (like login)
      router.push('/app');
      return;
    }
  }, [isAuthenticated, isLoading, requireAuth, router, pathname, redirectTo]);

  // Show loading spinner while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // If requiring auth but not authenticated, don't render children
  if (requireAuth && !isAuthenticated) {
    return null;
  }

  // If not requiring auth but authenticated, don't render children (redirect will happen)
  if (!requireAuth && isAuthenticated) {
    return null;
  }

  // Show onboarding wizard if user is authenticated but needs onboarding
  if (requireAuth && isAuthenticated && user?.firstTime) {
    return (
      <OnboardingWizard
        isOpen={true}
        onComplete={() => {
          // Refresh user data after onboarding
          window.location.reload();
        }}
      />
    );
  }

  return <>{children}</>;
}

// Higher-order component for easier usage
export function withAuthGuard<P extends object>(
  Component: React.ComponentType<P>,
  options?: { requireAuth?: boolean; redirectTo?: string }
) {
  return function WrappedComponent(props: P) {
    return (
      <AuthGuard {...options}>
        <Component {...props} />
      </AuthGuard>
    );
  };
}