"use client";
import Link from 'next/link';
import { useAuth } from '../../lib/auth';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  return (
    <div>
      <nav className="space-x-4 p-2 border-b">
        <Link href="/app">Chat</Link>
        <Link href="/app/data-room">Data Room</Link>
        <Link href="/app/logs">Logs</Link>
        <Link href="/app/admin/members">Admin</Link>
        <span className="float-right">{user}</span>
      </nav>
      <main className="p-4">{children}</main>
    </div>
  );
}
