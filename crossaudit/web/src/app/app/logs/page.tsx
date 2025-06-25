"use client";
import { useEffect, useState } from 'react';

export default function Logs() {
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/logs').then(r => r.json()).then(setLogs);
  }, []);

  return (
    <div>
      <h2 className="text-xl mb-2">Audit Log</h2>
      <pre className="whitespace-pre-wrap">
        {JSON.stringify(logs, null, 2)}
      </pre>
    </div>
  );
}
