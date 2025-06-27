"use client";
import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { VerifyEmailForm } from '@/components/auth/VerifyEmailForm';
import { useAuth } from '@/lib/auth-supabase';
import { endpoints } from '@/lib/api';

export default function VerifyEmailPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated } = useAuth();
  
  // Note: Supabase handles email verification automatically via links
  // This page can be simplified or used for manual code entry if needed
  
  const email = searchParams?.get('email');

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      router.push('/app');
    }
  }, [isAuthenticated, router]);

  const handleVerify = async (code: string) => {
    setIsLoading(true);
    setError(null);

    try {
      // With Supabase, email verification is typically handled via email links
      // For manual code entry, you would need to implement a custom verification flow
      setError('Email verification is handled automatically via email links with Supabase.');
    } catch (error) {
      setError('Verification failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (!email) {
      setError('No email address provided');
      return;
    }

    setError(null);
    // Supabase handles resending verification emails automatically
    // You could implement resend functionality using Supabase admin API if needed
    setError('Please check your email for the verification link. Resend functionality requires additional setup.');
  };

  if (!email) {
    return (
      <AuthLayout
        title="Email verification"
        subtitle="Invalid verification link"
      >
        <div className="text-center space-y-4">
          <p className="text-muted-600 dark:text-muted-400">
            No email address provided. Please check your verification link or try registering again.
          </p>
          <div className="space-y-2">
            <a
              href="/register"
              className="block w-full bg-primary text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Register
            </a>
            <a
              href="/login"
              className="block w-full text-primary text-sm font-medium hover:text-primary/80"
            >
              Back to Sign In
            </a>
          </div>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Verify your email"
      subtitle="Enter the verification code we sent you"
    >
      <VerifyEmailForm
        onVerify={handleVerify}
        onResend={handleResend}
        email={email}
        isLoading={isLoading}
        error={error}
      />
      
      {/* Back to login link */}
      <div className="mt-6 text-center">
        <a
          href="/login"
          className="text-sm font-medium text-primary hover:text-primary/80"
        >
          Back to Sign In
        </a>
      </div>
    </AuthLayout>
  );
}