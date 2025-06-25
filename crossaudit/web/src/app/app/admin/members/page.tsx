"use client";
import { useEffect, useState } from 'react';

export default function Members() {
  const [members, setMembers] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/org/members').then(r => r.json()).then(setMembers);
  }, []);

  return (
    <div>
<<<<<<< codex/enhance-and-complete-web-app
      <h2 className="text-xl mb-4 font-semibold">Members</h2>
      <ul className="space-y-1">
        {members.map((m, i) => (
          <li key={i} className="border rounded p-2 bg-white">
            {JSON.stringify(m)}
          </li>
=======
<<<<<<< vlw2xb-codex/enhance-and-complete-web-app
      <h2 className="text-xl mb-4 font-semibold">Members</h2>
      <ul className="space-y-1">
        {members.map((m, i) => (
          <li key={i} className="border rounded p-2 bg-white">
            {JSON.stringify(m)}
          </li>
=======
      <h2 className="text-xl mb-2">Members</h2>
      <ul className="list-disc ml-6">
        {members.map((m, i) => (
          <li key={i}>{JSON.stringify(m)}</li>
>>>>>>> main
>>>>>>> main
        ))}
      </ul>
    </div>
  );
}
