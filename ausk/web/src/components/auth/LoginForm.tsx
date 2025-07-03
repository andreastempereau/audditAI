"use client";
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { SocialAuthButton } from '@/components/auth/SocialAuthButton';
import { useAuth } from '@/lib/auth-supabase';
import { cn } from '@/lib/utils';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().default(false),
});

type LoginFormData = z.infer<typeof loginSchema>;

interface LoginFormProps {
  redirectMessage?: string;
  redirectPath?: string;
}

export function LoginForm({ redirectMessage, redirectPath }: LoginFormProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { signIn, signInWithOAuth, isAuthenticated, error, clearError } = useAuth();

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      rememberMe: true,
    },
  });

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      const redirect = redirectPath || '/app';
      router.push(redirect);
    }
  }, [isAuthenticated, router, redirectPath]);

  // Clear auth errors when component mounts
  useEffect(() => {
    clearError();
  }, [clearError]);

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    clearError();

    try {
      await signIn(data.email, data.password, data.rememberMe);
      // Redirect will happen automatically via useEffect
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('Invalid login credentials')) {
          setError('email', { message: 'Invalid email or password' });
          setError('password', { message: 'Invalid email or password' });
        } else if (error.message.includes('Email not confirmed')) {
          router.push(`/verify-email?email=${encodeURIComponent(data.email)}`);
        } else {
          setError('email', { message: error.message });
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSocialAuth = async (provider: 'google' | 'microsoft' | 'github') => {
    try {
      // Map microsoft to azure for Supabase
      const supabaseProvider = provider === 'microsoft' ? 'azure' : provider;
      await signInWithOAuth(supabaseProvider as 'google' | 'github' | 'azure');
    } catch (error) {
      console.error('OAuth error:', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Redirect message */}
      {redirectMessage && (
        <div className="rounded-lg bg-warning-50 dark:bg-warning-900/20 border border-warning-200 dark:border-warning-800 p-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-warning-600" />
            <p className="text-sm text-warning-700 dark:text-warning-300">
              {redirectMessage}
            </p>
          </div>
        </div>
      )}

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

      {/* Login Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
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
            <p className="mt-1 text-sm text-error-600">{errors.email.message}</p>
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
              autoComplete="current-password"
              placeholder="Enter your password"
              className={cn(
                'pr-10',
                errors.password && 'border-error-500 focus:border-error-500 focus:ring-error-500'
              )}
              disabled={isLoading}
            />
            <button
              type="button"
              className="absolute inset-y-0 right-0 pr-3 flex items-center"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4 text-muted-400" />
              ) : (
                <Eye className="h-4 w-4 text-muted-400" />
              )}
            </button>
          </div>
          {errors.password && (
            <p className="mt-1 text-sm text-error-600">{errors.password.message}</p>
          )}
        </div>

        {/* Remember me & Forgot password */}
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <input
              {...register('rememberMe')}
              id="remember-me"
              type="checkbox"
              className="h-4 w-4 text-primary focus:ring-primary border-muted-300 rounded"
            />
            <label htmlFor="remember-me" className="ml-2 block text-sm text-muted-700 dark:text-muted-300">
              Remember me
            </label>
          </div>

          <div className="text-sm">
            <a
              href="/forgot-password"
              className="font-medium text-primary hover:text-primary/80"
            >
              Forgot your password?
            </a>
          </div>
        </div>

        {/* Auth Error */}
        {error && (
          <div className="rounded-lg bg-error-50 dark:bg-error-900/20 border border-error-200 dark:border-error-800 p-3">
            <p className="text-sm text-error-700 dark:text-error-300">{error}</p>
          </div>
        )}

        {/* Submit Button */}
        <Button
          type="submit"
          className="w-full"
          disabled={isLoading}
        >
          {isLoading ? 'Signing in...' : 'Sign in'}
        </Button>
      </form>

      {/* Sign up link */}
      <p className="text-center text-sm text-muted-600 dark:text-muted-400">
        Don't have an account?{' '}
        <a
          href="/register"
          className="font-medium text-primary hover:text-primary/80"
        >
          Sign up
        </a>
      </p>
    </div>
  );
}