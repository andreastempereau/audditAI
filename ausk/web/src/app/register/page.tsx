"use client";
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Check } from 'lucide-react';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { SocialAuthButton } from '@/components/auth/SocialAuthButton';
import { PasswordStrengthMeter } from '@/components/auth/PasswordStrengthMeter';
import { useAuth } from '@/lib/auth-supabase';
import { cn } from '@/lib/utils';

const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  password: z
    .string()
    .min(12, 'Password must be at least 12 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/\d/, 'Password must contain at least one number')
    .regex(/[!@#$%^&*(),.?\":{}|<>]/, 'Password must contain at least one special character'),
  agreeToTerms: z.boolean().refine(val => val === true, {
    message: 'You must agree to the terms and conditions',
  }),
});

type RegisterFormData = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [registrationSuccess, setRegistrationSuccess] = useState(false);
  const router = useRouter();
  const { signUp: registerUser, isAuthenticated, error, clearError } = useAuth();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
    setError,
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  });

  const watchedPassword = watch('password', '');

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      router.push('/app');
    }
  }, [isAuthenticated, router]);

  // Clear auth errors when component mounts
  useEffect(() => {
    clearError();
  }, [clearError]);

  const onSubmit = async (data: RegisterFormData) => {
    setIsLoading(true);
    clearError();

    try {
      await registerUser(data.email, data.password, data.name);
      setRegistrationSuccess(true);
      // Redirect to verification page
      router.push(`/verify-email?email=${encodeURIComponent(data.email)}`);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('User already registered')) {
          setError('email', { message: 'An account with this email already exists' });
        } else if (error.message.includes('Password')) {
          setError('password', { message: 'Password does not meet security requirements' });
        } else {
          setError('email', { message: error.message });
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const { signInWithOAuth } = useAuth();

  const handleSocialAuth = async (provider: 'google' | 'microsoft' | 'github') => {
    try {
      // Map microsoft to azure for Supabase
      const supabaseProvider = provider === 'microsoft' ? 'azure' : provider;
      await signInWithOAuth(supabaseProvider as 'google' | 'github' | 'azure');
    } catch (error) {
      console.error('OAuth error:', error);
    }
  };

  if (registrationSuccess) {
    return (
      <AuthLayout
        title="Check your email"
        subtitle="We've sent you a verification code"
      >
        <div className="text-center space-y-4">
          <div className="w-16 h-16 mx-auto bg-success-100 dark:bg-success-900/20 rounded-full flex items-center justify-center">
            <Check className="w-8 h-8 text-success-600" />
          </div>
          <p className="text-muted-600 dark:text-muted-400">
            Please check your email and enter the 6-digit verification code to complete your registration.
          </p>
          <Button
            onClick={() => router.push('/login')}
            variant="secondary"
            className="w-full"
          >
            Back to Sign In
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Start securing your documents today"
    >
      <div className="space-y-6">
        {/* Social Auth */}
        <div className="space-y-3">
          <SocialAuthButton
            provider="google"
            onClick={() => handleSocialAuth('google')}
            disabled={isLoading}
          />
          <SocialAuthButton
            provider="microsoft"
            onClick={() => handleSocialAuth('microsoft')}
            disabled={isLoading}
          />
        </div>

        {/* Divider */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-muted-300 dark:border-muted-700" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white dark:bg-muted-900 text-muted-500">
              Or continue with email
            </span>
          </div>
        </div>

        {/* Registration Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Name */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-muted-700 dark:text-muted-300 mb-2">
              Full name
            </label>
            <Input
              {...register('name')}
              id="name"
              type="text"
              autoComplete="name"
              placeholder="Enter your full name"
              className={cn(errors.name && 'border-error-500 focus:border-error-500 focus:ring-error-500')}
              disabled={isLoading}
            />
            {errors.name && (
              <p className="mt-1 text-sm text-error-600 dark:text-error-400" role="alert">
                {errors.name.message}
              </p>
            )}
          </div>

          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-muted-700 dark:text-muted-300 mb-2">
              Email address
            </label>
            <Input
              {...register('email')}
              id="email"
              type="email"
              autoComplete="email"
              placeholder="Enter your email"
              className={cn(errors.email && 'border-error-500 focus:border-error-500 focus:ring-error-500')}
              disabled={isLoading}
            />
            {errors.email && (
              <p className="mt-1 text-sm text-error-600 dark:text-error-400" role="alert">
                {errors.email.message}
              </p>
            )}
          </div>

          {/* Password */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-muted-700 dark:text-muted-300 mb-2">
              Password
            </label>
            <div className="relative">
              <Input
                {...register('password')}
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="Create a strong password"
                className={cn(
                  'pr-10',
                  errors.password && 'border-error-500 focus:border-error-500 focus:ring-error-500'
                )}
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-500 hover:text-muted-700 dark:hover:text-muted-300"
                disabled={isLoading}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
                <span className="sr-only">
                  {showPassword ? 'Hide password' : 'Show password'}
                </span>
              </button>
            </div>
            
            {/* Password Strength Meter */}
            <div className="mt-2">
              <PasswordStrengthMeter password={watchedPassword} />
            </div>

            {errors.password && (
              <p className="mt-1 text-sm text-error-600 dark:text-error-400" role="alert">
                {errors.password.message}
              </p>
            )}
          </div>

          {/* Terms Agreement */}
          <div className="flex items-start">
            <input
              {...register('agreeToTerms')}
              id="agreeToTerms"
              type="checkbox"
              className={cn(
                'mt-1 h-4 w-4 text-primary focus:ring-primary border-muted-300 dark:border-muted-700 rounded',
                errors.agreeToTerms && 'border-error-500'
              )}
              disabled={isLoading}
            />
            <label htmlFor="agreeToTerms" className="ml-3 block text-sm text-muted-700 dark:text-muted-300">
              I agree to the{' '}
              <a href="/terms" className="text-primary hover:text-primary/80 underline">
                Terms of Service
              </a>{' '}
              and{' '}
              <a href="/privacy" className="text-primary hover:text-primary/80 underline">
                Privacy Policy
              </a>
            </label>
          </div>
          {errors.agreeToTerms && (
            <p className="text-sm text-error-600 dark:text-error-400" role="alert">
              {errors.agreeToTerms.message}
            </p>
          )}

          {/* Submit */}
          <Button
            type="submit"
            disabled={isLoading}
            className="w-full"
          >
            {isLoading ? 'Creating account...' : 'Create account'}
          </Button>
        </form>

        {/* Sign in link */}
        <div className="text-center">
          <p className="text-sm text-muted-600 dark:text-muted-400">
            Already have an account?{' '}
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