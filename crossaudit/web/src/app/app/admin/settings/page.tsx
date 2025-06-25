"use client";
import { useState } from 'react';

export default function Settings() {
  const [url, setUrl] = useState('');

  async function save() {
    await fetch('/api/org/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    alert('Webhook updated');
  }

  return (
    <div>
      <h2 className="text-xl mb-2">Webhook URL</h2>
      <input
        className="border p-1"
        value={url}
        onChange={e => setUrl(e.target.value)}
      />
      <button className="ml-2" onClick={save}>Save</button>
    </div>
  );
}
