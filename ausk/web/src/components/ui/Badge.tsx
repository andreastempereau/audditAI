import React from 'react';
import { cn } from '@/lib/utils';

interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'error';
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
            'bg-primary text-primary-foreground border-transparent': variant === 'default',
            'bg-secondary text-secondary-foreground border-transparent': variant === 'secondary',
            'bg-destructive text-destructive-foreground border-transparent': variant === 'destructive',
            'border-border bg-background text-foreground': variant === 'outline',
            'bg-success text-success-foreground border-transparent': variant === 'success',
            'bg-warning text-warning-foreground border-transparent': variant === 'warning',
            'bg-error text-error-foreground border-transparent': variant === 'error',
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