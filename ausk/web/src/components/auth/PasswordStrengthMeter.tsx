import React from 'react';
import { cn } from '@/lib/utils';

interface PasswordStrengthMeterProps {
  password: string;
  className?: string;
}

export function PasswordStrengthMeter({ password, className }: PasswordStrengthMeterProps) {
  const getPasswordStrength = (password: string) => {
    if (!password) return { score: 0, feedback: '', color: 'bg-muted-200' };

    let score = 0;
    const feedback: string[] = [];

    // Length check
    if (password.length >= 12) {
      score += 1;
    } else {
      feedback.push('At least 12 characters');
    }

    // Uppercase check
    if (/[A-Z]/.test(password)) {
      score += 1;
    } else {
      feedback.push('One uppercase letter');
    }

    // Lowercase check
    if (/[a-z]/.test(password)) {
      score += 1;
    } else {
      feedback.push('One lowercase letter');
    }

    // Number check
    if (/\d/.test(password)) {
      score += 1;
    } else {
      feedback.push('One number');
    }

    // Special character check
    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      score += 1;
    } else {
      feedback.push('One special character');
    }

    // Common patterns check
    const commonPatterns = [
      /password/i,
      /123456/,
      /qwerty/i,
      /abc123/i,
      /admin/i,
    ];

    const hasCommonPattern = commonPatterns.some(pattern => pattern.test(password));
    if (hasCommonPattern) {
      score = Math.max(0, score - 2);
      feedback.push('Avoid common patterns');
    }

    const strengthLevels = [
      { label: 'Very Weak', color: 'bg-error-500', textColor: 'text-error-600' },
      { label: 'Weak', color: 'bg-warning-500', textColor: 'text-warning-600' },
      { label: 'Fair', color: 'bg-warning-400', textColor: 'text-warning-600' },
      { label: 'Good', color: 'bg-success-400', textColor: 'text-success-600' },
      { label: 'Strong', color: 'bg-success-500', textColor: 'text-success-600' },
    ];

    const level = strengthLevels[Math.min(score, 4)];

    return {
      score,
      label: level.label,
      color: level.color,
      textColor: level.textColor,
      feedback: feedback.join(', '),
      isValid: score >= 4 && !hasCommonPattern,
    };
  };

  const strength = getPasswordStrength(password);

  if (!password) return null;

  return (
    <div className={cn('space-y-2', className)}>
      {/* Strength Bar */}
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((level) => (
          <div
            key={level}
            className={cn(
              'h-1 flex-1 rounded-full transition-colors duration-200',
              level <= strength.score ? strength.color : 'bg-muted-200 dark:bg-muted-700'
            )}
          />
        ))}
      </div>

      {/* Strength Label and Feedback */}
      <div className="flex items-center justify-between text-xs">
        <span className={cn('font-medium', strength.textColor)}>
          {strength.label}
        </span>
        {strength.feedback && (
          <span className="text-muted-600 dark:text-muted-400">
            Need: {strength.feedback}
          </span>
        )}
      </div>
    </div>
  );
}