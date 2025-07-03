import React from 'react';
import { Shield } from 'lucide-react';

interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}

export function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-muted-50 via-white to-primary/5 dark:from-muted-950 dark:via-muted-900 dark:to-primary/10 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* Logo */}
        <div className="flex justify-center">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-primary to-accent rounded-xl flex items-center justify-center shadow-lg">
              <Shield className="w-7 h-7 text-white" />
            </div>
            <div className="text-2xl font-bold text-muted-900 dark:text-white">
              Ausk
            </div>
          </div>
        </div>

        {/* Title */}
        <div className="mt-8 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-muted-900 dark:text-white">
            {title}
          </h2>
          {subtitle && (
            <p className="mt-2 text-sm text-muted-600 dark:text-muted-400">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white dark:bg-muted-900 py-8 px-4 shadow-xl rounded-xl border border-muted-200 dark:border-muted-800 sm:px-10">
          {children}
        </div>
      </div>

      {/* Footer */}
      <div className="mt-8 text-center">
        <p className="text-xs text-muted-500">
          Secure document management for compliance teams
        </p>
      </div>
    </div>
  );
}