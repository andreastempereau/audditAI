"use client";
import Link from 'next/link';
import { useAuth } from '../../lib/auth';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  return (
<<<<<<< codex/enhance-and-complete-web-app
=======
<<<<<<< vlw2xb-codex/enhance-and-complete-web-app
>>>>>>> main
    <div className="min-h-screen flex flex-col">
      <nav className="bg-gray-800 text-white px-4 py-2 flex items-center space-x-4">
        <Link className="hover:underline" href="/app">Chat</Link>
        <Link className="hover:underline" href="/app/data-room">Data Room</Link>
        <Link className="hover:underline" href="/app/logs">Logs</Link>
        <Link className="hover:underline" href="/app/admin/members">Admin</Link>
        <span className="ml-auto text-sm">{user}</span>
<<<<<<< codex/enhance-and-complete-web-app
      </nav>
      <main className="flex-1 max-w-4xl w-full mx-auto p-4">{children}</main>
=======
      </nav>
      <main className="flex-1 max-w-4xl w-full mx-auto p-4">{children}</main>
=======
    <div>
      <nav className="space-x-4 p-2 border-b">
        <Link href="/app">Chat</Link>
        <Link href="/app/data-room">Data Room</Link>
        <Link href="/app/logs">Logs</Link>
        <Link href="/app/admin/members">Admin</Link>
        <span className="float-right">{user}</span>
      </nav>
      <main className="p-4">{children}</main>
>>>>>>> main
>>>>>>> main
    </div>
  );
}
