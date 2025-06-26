"use client";
import { useEffect, useState } from 'react';
import Spinner from '../../components/Spinner';

export default function DataRoom() {
  const [docs, setDocs] = useState<string[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    const d = await fetch('/api/docs').then(r => r.json());
    setDocs(d);
  }

  useEffect(() => {
    load();
  }, []);

  async function upload() {
    if (!file) return;
    setLoading(true);
    const buf = await file.arrayBuffer();
    await fetch('/api/upload', { method: 'POST', body: buf });
    setFile(null);
    await load();
    setLoading(false);
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Documents</h2>
      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
        {docs.map(d => (
          <div key={d} className="p-3 bg-white rounded shadow flex justify-between items-center animate-fadeIn">
            <span className="truncate mr-2" title={d}>{d}</span>
            <a
              href={`/api/docs/${d}`}
              className="text-blue-600 hover:underline whitespace-nowrap"
            >
              View
            </a>
          </div>
        ))}
      </div>
      <div className="flex items-center space-x-2">
        <input
          type="file"
          className="border rounded p-1 flex-1"
          onChange={e => setFile(e.target.files?.[0] || null)}
        />
        <button
          className="bg-blue-600 text-white px-3 py-1 rounded disabled:opacity-50"
          onClick={upload}
          disabled={loading || !file}
        >
          {loading ? <Spinner /> : 'Upload'}
        </button>
      </div>
    </div>
  );
}
