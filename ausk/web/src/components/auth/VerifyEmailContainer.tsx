"use client";
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-supabase';
import { createClientComponentClient } from '@/lib/supabase-client';

interface VerifyEmailContainerProps {
  email: string;
}

export function VerifyEmailContainer({ email }: VerifyEmailContainerProps) {
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const supabase = createClientComponentClient();

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      router.push('/app');
    }
  }, [isAuthenticated, router]);

  // Countdown for resend button
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    
    setIsLoading(true);
    setError(null);

    try {
      console.log('Verifying OTP:', { email, code: code.trim() });
      
      // Verify the OTP
      const { data: otpData, error: otpError } = await supabase.auth.verifyOtp({
        email: email,
        token: code.trim(),
        type: 'email'
      });

      console.log('OTP verification result:', { otpData, otpError });

      if (otpError) {
        console.error('OTP verification error:', otpError);
        setError(otpError.message);
        return;
      }

      // If OTP is valid and this is a signup flow, complete the signup
      const pendingSignup = sessionStorage.getItem('pendingSignup');
      if (pendingSignup && otpData.user) {
        const { email: signupEmail, password, name } = JSON.parse(pendingSignup);
        
        // Only proceed if emails match
        if (signupEmail === email) {
          console.log('Completing signup after email verification');
          
          // Now create the actual user account
          const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
            email,
            password,
            options: {
              data: {
                name,
              },
            },
          });

          if (signUpError) {
            console.error('Signup error after verification:', signUpError);
            setError(signUpError.message);
            return;
          }

          // Clear the pending signup data
          sessionStorage.removeItem('pendingSignup');
          
          // Sign in the user
          const { error: signInError } = await supabase.auth.signInWithPassword({
            email,
            password
          });

          if (signInError) {
            console.error('Auto sign-in error:', signInError);
            // User is created but not signed in, redirect to login
            router.push('/login?verified=true');
          } else {
            console.log('User signed in successfully, redirecting to onboarding');
            router.push('/onboarding');
          }
        }
      } else {
        // Regular OTP verification (not signup)
        console.log('OTP verification successful');
        router.push('/app');
      }
    } catch (error) {
      console.error('OTP verification exception:', error);
      setError('Failed to verify code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    
    setIsLoading(true);
    setError(null);

    try {
      // Resend OTP for email verification
      const { error } = await supabase.auth.signInWithOtp({
        email: email,
        options: {
          shouldCreateUser: false
        }
      });

      if (error) {
        setError(error.message);
      } else {
        setResendCooldown(60); // 60 second cooldown
        setError(null);
      }
    } catch (error) {
      setError('Failed to resend verification code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-4">
        <p className="text-muted-600 dark:text-muted-400">
          We've sent a verification code to
        </p>
        <p className="font-medium text-lg text-muted-900 dark:text-white">
          {email}
        </p>
        <p className="text-sm text-muted-500 dark:text-muted-400">
          Enter the 6-digit code from your email to verify your account.
        </p>
      </div>

      <form onSubmit={handleVerify} className="space-y-4">
        <div>
          <label htmlFor="code" className="block text-sm font-medium text-muted-700 dark:text-muted-300 mb-2">
            Verification Code
          </label>
          <input
            id="code"
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
            placeholder="Enter 6-digit code"
            className="w-full px-3 py-2 border border-muted-300 dark:border-muted-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-muted-800 text-center text-lg font-mono tracking-wider"
            maxLength={6}
            required
          />
        </div>

        {error && (
          <div className="rounded-lg bg-error-50 dark:bg-error-900/20 border border-error-200 dark:border-error-800 p-3">
            <p className="text-sm text-error-700 dark:text-error-300">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading || code.length !== 6}
          className="w-full bg-primary text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? 'Verifying...' : 'Verify Email'}
        </button>
      </form>

      <div className="space-y-4">
        <button
          onClick={handleResend}
          disabled={isLoading || resendCooldown > 0}
          className="w-full bg-muted-100 dark:bg-muted-700 text-muted-700 dark:text-muted-300 rounded-lg px-4 py-2 text-sm font-medium hover:bg-muted-200 dark:hover:bg-muted-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? 'Sending...' : resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend verification code'}
        </button>

        <div className="text-center text-sm text-muted-500 dark:text-muted-400">
          <p>Already verified? <a href="/login" className="text-primary hover:text-primary/80">Sign in</a></p>
        </div>
      </div>

      <div className="mt-6 p-4 bg-muted-50 dark:bg-muted-800 rounded-lg">
        <h4 className="text-sm font-medium text-muted-900 dark:text-white mb-2">Didn't receive the code?</h4>
        <ul className="text-xs text-muted-600 dark:text-muted-400 space-y-1">
          <li>• Check your spam/junk folder</li>
          <li>• Make sure {email} is correct</li>
          <li>• Try resending the verification code</li>
          <li>• Contact support if issues persist</li>
        </ul>
      </div>
    </div>
  );
}