"use client";
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { VerifyEmailForm } from '@/components/auth/VerifyEmailForm';
import { useAuth } from '@/lib/auth-supabase';

interface VerifyEmailContainerProps {
  email: string;
}

export function VerifyEmailContainer({ email }: VerifyEmailContainerProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { isAuthenticated } = useAuth();

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
    setError(null);
    // Supabase handles resending verification emails automatically
    // You could implement resend functionality using Supabase admin API if needed
    setError('Please check your email for the verification link. Resend functionality requires additional setup.');
  };

  return (
    <VerifyEmailForm
      onVerify={handleVerify}
      onResend={handleResend}
      email={email}
      isLoading={isLoading}
      error={error}
    />
  );
}