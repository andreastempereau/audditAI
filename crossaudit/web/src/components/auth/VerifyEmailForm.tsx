"use client";
import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

interface VerifyEmailFormProps {
  onVerify: (code: string) => Promise<void>;
  onResend: () => Promise<void>;
  email?: string;
  isLoading?: boolean;
  error?: string | null;
}

export function VerifyEmailForm({
  onVerify,
  onResend,
  email,
  isLoading = false,
  error,
}: VerifyEmailFormProps) {
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [resendCooldown, setResendCooldown] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => {
        setResendCooldown(resendCooldown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleInputChange = (index: number, value: string) => {
    // Only allow single digits
    if (value.length > 1 || (value && !/^\d$/.test(value))) {
      return;
    }

    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all fields are filled
    if (value && index === 5 && newCode.every(digit => digit)) {
      handleSubmit(newCode.join(''));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      // Focus previous input on backspace if current is empty
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      inputRefs.current[index + 1]?.focus();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const fullCode = code.join('');
      if (fullCode.length === 6) {
        handleSubmit(fullCode);
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    
    if (pastedData.length === 6) {
      const newCode = pastedData.split('');
      setCode(newCode);
      inputRefs.current[5]?.focus();
      handleSubmit(pastedData);
    }
  };

  const handleSubmit = async (submitCode?: string) => {
    const fullCode = submitCode || code.join('');
    if (fullCode.length !== 6) return;

    try {
      await onVerify(fullCode);
    } catch (error) {
      // Error handling is done by parent component
      // Reset form on error
      setCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    
    try {
      await onResend();
      setResendCooldown(30); // 30 second cooldown
    } catch (error) {
      // Error handling is done by parent component
    }
  };

  return (
    <div className="space-y-6">
      {/* Email display */}
      {email && (
        <div className="text-center">
          <p className="text-sm text-muted-600 dark:text-muted-400">
            We've sent a verification code to
          </p>
          <p className="font-medium text-muted-900 dark:text-white mt-1">
            {email}
          </p>
        </div>
      )}

      {/* Code input */}
      <div className="space-y-4">
        <div className="flex justify-center gap-3">
          {code.map((digit, index) => (
            <input
              key={index}
              ref={(el) => { inputRefs.current[index] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleInputChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              onPaste={index === 0 ? handlePaste : undefined}
              className={cn(
                'w-12 h-12 text-center text-lg font-semibold',
                'border-2 rounded-lg',
                'focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary',
                'bg-white dark:bg-muted-800',
                'border-muted-300 dark:border-muted-700',
                'text-muted-900 dark:text-white',
                'transition-colors duration-200',
                error && 'border-error-500 focus:border-error-500 focus:ring-error-500'
              )}
              aria-label={`Verification code digit ${index + 1}`}
              disabled={isLoading}
            />
          ))}
        </div>

        {/* Error message */}
        {error && (
          <div className="text-center">
            <p className="text-sm text-error-600 dark:text-error-400" role="alert">
              {error}
            </p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="space-y-4">
        <Button
          onClick={() => handleSubmit()}
          disabled={code.join('').length !== 6 || isLoading}
          className="w-full"
        >
          {isLoading ? 'Verifying...' : 'Verify Email'}
        </Button>

        <div className="text-center">
          <p className="text-sm text-muted-600 dark:text-muted-400">
            Didn't receive the code?{' '}
            <button
              onClick={handleResend}
              disabled={resendCooldown > 0 || isLoading}
              className={cn(
                'font-medium underline',
                resendCooldown > 0 || isLoading
                  ? 'text-muted-400 cursor-not-allowed'
                  : 'text-primary hover:text-primary/80'
              )}
            >
              {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}