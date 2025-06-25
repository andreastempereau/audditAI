"use client";
import { useEffect, useState } from 'react';

export default function Logs() {
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/logs').then(r => r.json()).then(setLogs);
  }, []);

  return (
    <div>
      <h2 className="text-xl mb-4 font-semibold">Audit Log</h2>
      <ul className="space-y-1">
        {logs.map((l, i) => (
          <li key={i} className="border rounded p-2 bg-white">
            <a className="text-blue-600 hover:underline" href={`/app/logs/${l.id}`}>{l.id}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}
