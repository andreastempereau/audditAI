import Link from 'next/link';

export default function Page() {
  return (
    <div className="p-4">
      <h1 className="text-2xl mb-4">Welcome to CrossAudit</h1>
      <Link href="/app" className="underline text-blue-600">Enter App</Link>
    </div>
  );
}
