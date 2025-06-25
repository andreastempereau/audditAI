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
<<<<<<< codex/enhance-and-complete-web-app
      <h2 className="text-xl mb-4 font-semibold">Webhook URL</h2>
=======
<<<<<<< vlw2xb-codex/enhance-and-complete-web-app
      <h2 className="text-xl mb-4 font-semibold">Webhook URL</h2>
      <input
        className="border p-1 w-64"
        value={url}
        onChange={e => setUrl(e.target.value)}
      />
      <button className="ml-2 bg-blue-600 text-white px-3 py-1 rounded" onClick={save}>Save</button>
=======
      <h2 className="text-xl mb-2">Webhook URL</h2>
>>>>>>> main
      <input
        className="border p-1 w-64"
        value={url}
        onChange={e => setUrl(e.target.value)}
      />
<<<<<<< codex/enhance-and-complete-web-app
      <button className="ml-2 bg-blue-600 text-white px-3 py-1 rounded" onClick={save}>Save</button>
=======
      <button className="ml-2" onClick={save}>Save</button>
>>>>>>> main
>>>>>>> main
    </div>
  );
}
