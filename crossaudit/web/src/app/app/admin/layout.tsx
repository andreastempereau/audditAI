"use client";
import Link from 'next/link';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside className="w-48 border-r p-4 space-y-2 bg-gray-50">
        <Link className="block hover:underline" href="/app/admin/members">Members</Link>
        <Link className="block hover:underline" href="/app/admin/policy">Policy</Link>
        <Link className="block hover:underline" href="/app/admin/settings">Settings</Link>
        <Link className="block hover:underline" href="/app/admin/billing">Billing</Link>
      </aside>
      <main className="flex-1 p-4">{children}</main>
    </div>
  );
}
