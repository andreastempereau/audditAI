import React from 'react';
import { cn } from '@/lib/utils';

interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'success' | 'warning' | 'error' | 'destructive' | 'confidential' | 'restricted' | 'public';
  size?: 'sm' | 'md';
}

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant = 'default', size = 'sm', ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'inline-flex items-center rounded-full border font-medium',
          {
            'px-2 py-0.5 text-xs': size === 'sm',
            'px-3 py-1 text-sm': size === 'md',
          },
          {
            'border-muted-200 bg-muted-50 text-muted-700': variant === 'default',
            'border-secondary bg-secondary text-secondary-foreground': variant === 'secondary',
            'border-success-200 bg-success-50 text-success-700': variant === 'success',
            'border-warning-200 bg-warning-50 text-warning-700': variant === 'warning',
            'border-error-200 bg-error-50 text-error-700': variant === 'error',
            'border-red-200 bg-red-50 text-red-700': variant === 'destructive',
            'border-error-500 bg-error-50 text-error-700': variant === 'confidential',
            'border-warning-500 bg-warning-50 text-warning-700': variant === 'restricted',
            'border-success-500 bg-success-50 text-success-700': variant === 'public',
          },
          className
        )}
        {...props}
      />
    );
  }
);

Badge.displayName = 'Badge';

export { Badge };