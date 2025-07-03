"use client";
import Toast from '../components/Toast';
import { useState } from 'react';
import { useAlerts } from '../lib/useAlerts';
import { ThemeProvider } from '@/lib/theme';
import { AuthProvider } from '@/lib/auth-supabase';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '../globals.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: (failureCount, error: any) => {
        // Don't retry on auth errors
        if (error?.status === 401 || error?.status === 403) {
          return false;
        }
        return failureCount < 3;
      },
    },
    mutations: {
      retry: false,
    },
  },
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [msg, setMsg] = useState('');
  // Temporarily disable alerts to prevent heartbeat popups
  // useAlerts(setMsg);
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <title>Ausk</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className="min-h-screen antialiased">
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <ThemeProvider defaultTheme="system" storageKey="ausk-theme">
              {children}
              <Toast message={msg} />
            </ThemeProvider>
          </AuthProvider>
        </QueryClientProvider>
      </body>
    </html>
  );
}
