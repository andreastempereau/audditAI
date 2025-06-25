"use client";
import { useState, useEffect } from 'react';

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
      <h2 className="text-xl mb-4 font-semibold">Webhook URL</h2>
      <input
        className="border p-1 w-64"
        value={url}
        onChange={e => setUrl(e.target.value)}
      />
      <button className="ml-2 bg-blue-600 text-white px-3 py-1 rounded" onClick={save}>Save</button>
      <ApiKeys />
    </div>
  );
}

export function ApiKeys() {
  const [keys, setKeys] = useState<any[]>([]);
  const [provider, setProvider] = useState('');
  const [apiKey, setApiKey] = useState('');

  async function load() {
    const res = await fetch('/api/keys').then(r => r.json());
    setKeys(res);
  }

  async function add() {
    await fetch('/api/keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, api_key: apiKey }),
    });
    setProvider('');
    setApiKey('');
    load();
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="mt-6">
      <h3 className="text-lg mb-2 font-semibold">API Keys</h3>
      <ul className="space-y-1 mb-2">
        {keys.map((k, i) => (
          <li key={i} className="border rounded p-2 bg-white">{k.provider}</li>
        ))}
      </ul>
      <input className="border p-1 mr-2" value={provider} onChange={e => setProvider(e.target.value)} placeholder="provider" />
      <input className="border p-1 mr-2" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="key" />
      <button className="bg-blue-600 text-white px-3 py-1 rounded" onClick={add}>Add</button>
    </div>
  );
}
