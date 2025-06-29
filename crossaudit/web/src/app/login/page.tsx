import React from 'react';
import { LoginForm } from '@/components/auth/LoginForm';
import { AuthLayout } from '@/components/auth/AuthLayout';

interface LoginPageProps {
  searchParams: { [key: string]: string | string[] | undefined };
}

export default function LoginPage({ searchParams }: LoginPageProps) {
  const redirectMessage = searchParams?.message as string;
  const redirectPath = searchParams?.redirect as string;

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to your CrossAudit account"
    >
      <LoginForm 
        redirectMessage={redirectMessage}
        redirectPath={redirectPath}
      />
    </AuthLayout>
  );
}