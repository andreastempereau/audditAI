"use client";
import { useEffect, useState } from 'react';
import Spinner from '@/components/Spinner';

interface LogEntry { id: string }

export default function Logs() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/logs')
      .then(r => r.json())
      .then(d => {
        setLogs(d);
        setLoading(false);
      });
  }, []);

  if (loading) return <Spinner />;
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Audit Log</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left text-sm font-medium text-gray-500">ID</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {logs.map(l => (
              <tr key={l.id} className="hover:bg-gray-50">
                <td className="px-3 py-2 whitespace-nowrap">
                  <a className="text-blue-600 hover:underline" href={`/app/logs/${l.id}`}>{l.id}</a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
