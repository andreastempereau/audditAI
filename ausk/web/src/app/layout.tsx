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
        <title>Ausk - AI Governance Platform</title>
        <meta name="description" content="Secure, compliant, and intelligent AI governance platform. Build trust with enterprise-grade monitoring, policy enforcement, and real-time insights for your AI systems." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        
        {/* Open Graph / Facebook */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://www.ausk.ai/" />
        <meta property="og:title" content="Ausk - AI Governance Platform" />
        <meta property="og:description" content="Secure, compliant, and intelligent AI governance platform. Build trust with enterprise-grade monitoring, policy enforcement, and real-time insights for your AI systems." />
        <meta property="og:image" content="https://www.ausk.ai/og-image.png" />

        {/* Twitter */}
        <meta property="twitter:card" content="summary_large_image" />
        <meta property="twitter:url" content="https://www.ausk.ai/" />
        <meta property="twitter:title" content="Ausk - AI Governance Platform" />
        <meta property="twitter:description" content="Secure, compliant, and intelligent AI governance platform. Build trust with enterprise-grade monitoring, policy enforcement, and real-time insights for your AI systems." />
        <meta property="twitter:image" content="https://www.ausk.ai/og-image.png" />

        {/* Favicon */}
        <link rel="icon" href="/favicon.ico" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/site.webmanifest" />
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