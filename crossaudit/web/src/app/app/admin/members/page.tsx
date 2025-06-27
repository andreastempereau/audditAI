"use client";
import { useEffect, useState } from 'react';
import Spinner from '@/components/Spinner';

export default function Members() {
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/org/members')
      .then(r => r.json())
      .then(d => {
        setMembers(d);
        setLoading(false);
      });
  }, []);

  if (loading) return <Spinner />;
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Members</h2>
      <ul className="space-y-1">
        {members.map((m, i) => (
          <li key={i} className="border rounded p-2 bg-white animate-fadeIn">
            {JSON.stringify(m)}
          </li>
        ))}
      </ul>
    </div>
  );
}
