"use client";
import { useEffect, useState } from 'react';

export default function Members() {
  const [members, setMembers] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/org/members').then(r => r.json()).then(setMembers);
  }, []);

  return (
    <div>
      <h2 className="text-xl mb-2">Members</h2>
      <ul className="list-disc ml-6">
        {members.map((m, i) => (
          <li key={i}>{JSON.stringify(m)}</li>
        ))}
      </ul>
    </div>
  );
}
