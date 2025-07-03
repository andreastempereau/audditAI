import React from 'react';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { VerifyEmailContainer } from '@/components/auth/VerifyEmailContainer';

interface VerifyEmailPageProps {
  searchParams: { [key: string]: string | string[] | undefined };
}

export default function VerifyEmailPage({ searchParams }: VerifyEmailPageProps) {
  const email = searchParams?.email as string;

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
      <VerifyEmailContainer email={email} />
      
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