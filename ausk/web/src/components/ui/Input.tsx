import React from 'react';
import { cn } from '@/lib/utils';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-10 w-full rounded-lg border bg-white px-3 py-2 text-sm',
          'placeholder:text-muted-500 focus:outline-none focus:ring-1',
          'disabled:cursor-not-allowed disabled:opacity-50',
          error
            ? 'border-error-500 focus:border-error-500 focus:ring-error-500'
            : 'border-muted-300 focus:border-primary focus:ring-primary',
          'dark:bg-muted-800 dark:border-muted-700 dark:text-white dark:placeholder:text-muted-400',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);

Input.displayName = 'Input';

export { Input };