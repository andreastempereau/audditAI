"use client";
import { useState, useEffect } from 'react';
import Spinner from '../../../components/Spinner';

export default function Settings() {
  const [url, setUrl] = useState('');
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    await fetch('/api/org/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    setSaving(false);
    alert('Webhook updated');
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold mb-2">Webhook URL</h2>
        <input
          className="border p-1 w-full max-w-sm rounded"
          value={url}
          onChange={e => setUrl(e.target.value)}
        />
        <button
          className="ml-2 bg-blue-600 text-white px-3 py-1 rounded disabled:opacity-50"
          onClick={save}
          disabled={saving}
        >
          {saving ? <Spinner /> : 'Save'}
        </button>
      </div>
      <ApiKeys />
    </div>
  );
}

export function ApiKeys() {
  const [keys, setKeys] = useState<any[]>([]);
  const [provider, setProvider] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [adding, setAdding] = useState(false);

  async function load() {
    const res = await fetch('/api/keys').then(r => r.json());
    setKeys(res);
  }

  async function add() {
    setAdding(true);
    await fetch('/api/keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, api_key: apiKey }),
    });
    setProvider('');
    setApiKey('');
    setAdding(false);
    load();
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-2">
      <h3 className="text-lg font-semibold">API Keys</h3>
      <ul className="space-y-1">
        {keys.map((k, i) => (
          <li key={i} className="border rounded p-2 bg-white">{k.provider}</li>
        ))}
      </ul>
      <div className="flex items-center space-x-2">
        <input className="border p-1 rounded flex-1" value={provider} onChange={e => setProvider(e.target.value)} placeholder="provider" />
        <input className="border p-1 rounded flex-1" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="key" />
        <button className="bg-blue-600 text-white px-3 py-1 rounded disabled:opacity-50" onClick={add} disabled={adding}>
          {adding ? <Spinner /> : 'Add'}
        </button>
      </div>
    </div>
  );
}
