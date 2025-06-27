"use client";
import { AppShell } from '@/layout/AppShell';
import { AuthGuard } from '@/components/auth/AuthGuard';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard requireAuth={true}>
      <AppShell>
        {children}
      </AppShell>
    </AuthGuard>
  );
}
