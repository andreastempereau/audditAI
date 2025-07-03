"use client";
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Mail, Check } from 'lucide-react';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { endpoints } from '@/lib/api';
import { cn } from '@/lib/utils';

const forgotPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    getValues,
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = async (data: ForgotPasswordFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      await endpoints.forgotPassword(data);
      setIsSuccess(true);
    } catch (error) {
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError('Failed to send reset email. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <AuthLayout
        title="Check your email"
        subtitle="We've sent you a password reset link"
      >
        <div className="text-center space-y-6">
          <div className="w-16 h-16 mx-auto bg-success-100 dark:bg-success-900/20 rounded-full flex items-center justify-center">
            <Check className="w-8 h-8 text-success-600" />
          </div>
          
          <div className="space-y-2">
            <p className="text-muted-600 dark:text-muted-400">
              We've sent a password reset link to:
            </p>
            <p className="font-medium text-muted-900 dark:text-white">
              {getValues('email')}
            </p>
          </div>

          <p className="text-sm text-muted-600 dark:text-muted-400">
            Check your email and click the link to reset your password. The link will expire in 30 minutes.
          </p>

          <div className="space-y-3">
            <Button
              onClick={() => setIsSuccess(false)}
              variant="secondary"
              className="w-full"
            >
              Try different email
            </Button>
            
            <a
              href="/login"
              className="block w-full text-center text-sm font-medium text-primary hover:text-primary/80"
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
      title="Forgot password?"
      subtitle="Enter your email to receive a reset link"
    >
      <div className="space-y-6">
        {/* Back to login */}
        <a
          href="/login"
          className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Sign In
        </a>

        {/* Reset form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-muted-700 dark:text-muted-300 mb-2">
              Email address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-500" />
              <Input
                {...register('email')}
                id="email"
                type="email"
                autoComplete="email"
                placeholder="Enter your email"
                className={cn(
                  'pl-10',
                  errors.email && 'border-error-500 focus:border-error-500 focus:ring-error-500'
                )}
                disabled={isLoading}
                autoFocus
              />
            </div>
            {errors.email && (
              <p className="mt-1 text-sm text-error-600 dark:text-error-400" role="alert">
                {errors.email.message}
              </p>
            )}
            {error && (
              <p className="mt-1 text-sm text-error-600 dark:text-error-400" role="alert">
                {error}
              </p>
            )}
          </div>

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full"
          >
            {isLoading ? 'Sending...' : 'Send reset link'}
          </Button>
        </form>

        {/* Help text */}
        <div className="text-center">
          <p className="text-sm text-muted-600 dark:text-muted-400">
            Remember your password?{' '}
            <a
              href="/login"
              className="font-medium text-primary hover:text-primary/80"
            >
              Sign in
            </a>
          </p>
        </div>
      </div>
    </AuthLayout>
  );
}