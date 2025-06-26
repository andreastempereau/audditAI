"use client";
import { useState } from 'react';

export default function Policy() {
  const [policy, setPolicy] = useState('');

  async function validate() {
    await fetch('/api/policy/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ policy }),
    });
    alert('Policy validated');
  }

  async function save() {
    await fetch('/api/policy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ policy }),
    });
    alert('Policy saved');
  }

  return (
    <div className="space-y-2">
      <h2 className="text-xl font-semibold">Policy</h2>
      <textarea
        className="w-full border p-2 h-40 rounded"
        value={policy}
        onChange={e => setPolicy(e.target.value)}
      />
      <div className="space-x-2">
        <button className="bg-gray-200 px-3 py-1 rounded" onClick={validate}>Validate</button>
        <button className="bg-blue-600 text-white px-3 py-1 rounded" onClick={save}>Save</button>
      </div>
    </div>
  );
}
