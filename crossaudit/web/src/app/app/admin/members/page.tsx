"use client";
import { useEffect, useState } from 'react';

export default function Members() {
  const [members, setMembers] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/org/members').then(r => r.json()).then(setMembers);
  }, []);

  return (
    <div>
      <h2 className="text-xl mb-4 font-semibold">Members</h2>
      <ul className="space-y-1">
        {members.map((m, i) => (
          <li key={i} className="border rounded p-2 bg-white">
            {JSON.stringify(m)}
          </li>
        ))}
      </ul>
    </div>
  );
}
