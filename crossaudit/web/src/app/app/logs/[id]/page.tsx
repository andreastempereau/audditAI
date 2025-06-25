"use client";
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

export default function LogDetail() {
  const params = useParams();
  const id = params?.id as string;
  const [log, setLog] = useState<any | null>(null);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/logs/${id}`).then(r => r.json()).then(setLog);
  }, [id]);

  if (!log) return <div>Loading...</div>;
  return (
    <pre className="whitespace-pre-wrap">{JSON.stringify(log, null, 2)}</pre>
  );
}
