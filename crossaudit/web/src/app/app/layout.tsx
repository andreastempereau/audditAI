"use client";
import Link from 'next/link';
import { useAuth } from '../../lib/auth';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  return (
    <div className="min-h-screen flex flex-col">
      <nav className="bg-gray-800 text-white px-4 py-2 flex items-center space-x-4 shadow">
        <Link className="hover:text-blue-300 transition-colors" href="/app">Chat</Link>
        <Link className="hover:text-blue-300 transition-colors" href="/app/data-room">Data Room</Link>
        <Link className="hover:text-blue-300 transition-colors" href="/app/logs">Logs</Link>
        <Link className="hover:text-blue-300 transition-colors" href="/app/admin/members">Admin</Link>
        <span className="ml-auto text-sm">{user}</span>
      </nav>
      <main className="flex-1 max-w-4xl w-full mx-auto p-4">{children}</main>
    </div>
  );
}
