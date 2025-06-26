"use client";
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Spinner from '../../../components/Spinner';

export default function LogDetail() {
  const { id } = useParams();
  const [log, setLog] = useState<any | null>(null);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/logs/${id}`).then(r => r.json()).then(setLog);
  }, [id]);

  if (!log) return <Spinner />;
  return (
    <div className="bg-white p-4 rounded shadow">
      <pre className="whitespace-pre-wrap text-sm">{JSON.stringify(log, null, 2)}</pre>
    </div>
  );
}
