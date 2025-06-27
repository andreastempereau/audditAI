import React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cn } from '@/lib/utils';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    
    return (
      <Comp
        className={cn(
          'inline-flex items-center justify-center rounded-lg font-medium transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
          'disabled:pointer-events-none disabled:opacity-50',
          // Variants
          {
            'bg-primary text-white hover:bg-primary/90 active:bg-primary/80 focus-visible:ring-primary': variant === 'primary',
            'bg-muted-100 text-muted-900 hover:bg-muted-200 active:bg-muted-300 focus-visible:ring-muted-500': variant === 'secondary',
            'text-muted-700 hover:bg-muted-100 active:bg-muted-200 focus-visible:ring-muted-500': variant === 'ghost',
            'bg-error-500 text-white hover:bg-error-600 active:bg-error-700 focus-visible:ring-error-500': variant === 'destructive',
          },
          // Sizes
          {
            'h-8 px-3 text-sm': size === 'sm',
            'h-10 px-4 text-sm': size === 'md',
            'h-12 px-6 text-base': size === 'lg',
          },
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);

Button.displayName = 'Button';

export { Button };