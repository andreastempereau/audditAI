"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ClearAuthPage() {
  const router = useRouter();

  useEffect(() => {
    // Clear all Supabase-related cookies
    document.cookie.split(';').forEach((cookie) => {
      const [name] = cookie.trim().split('=');
      if (name && (name.includes('sb-') || name.includes('supabase'))) {
        document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
        document.cookie = `${name}=; path=/; domain=${window.location.hostname}; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
      }
    });

    // Clear localStorage
    if (typeof window !== 'undefined') {
      Object.keys(localStorage).forEach(key => {
        if (key.includes('supabase') || key.includes('sb-')) {
          localStorage.removeItem(key);
        }
      });
    }

    // Redirect to login after clearing
    setTimeout(() => {
      router.push('/login');
    }, 100);
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-semibold mb-2">Clearing authentication data...</h1>
        <p className="text-muted-foreground">Redirecting to login page...</p>
      </div>
    </div>
  );
}