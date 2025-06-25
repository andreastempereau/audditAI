import Link from 'next/link';

export default function Page() {
  return (
    <div className="p-8 text-center space-y-4">
      <h1 className="text-3xl font-bold">Welcome to CrossAudit</h1>
      <p className="text-gray-600">Modern compliance and auditing tooling</p>
      <Link
        href="/app"
        className="inline-block bg-blue-600 text-white px-4 py-2 rounded"
      >
        Enter App
      </Link>
    </div>
  );
}
