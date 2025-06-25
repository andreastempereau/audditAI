"use client";
import { useEffect, useState } from 'react';

export default function DataRoom() {
  const [docs, setDocs] = useState<string[]>([]);
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    fetch('/api/docs').then(r => r.json()).then(setDocs);
  }, []);

  async function upload() {
    if (!file) return;
    const buf = await file.arrayBuffer();
    await fetch('/api/upload', { method: 'POST', body: buf });
    const d = await fetch('/api/docs').then(r => r.json());
    setDocs(d);
  }

  return (
    <div>
      <h2 className="text-xl mb-2">Documents</h2>
      <ul className="list-disc ml-6 mb-4">
        {docs.map(d => (
          <li key={d}>{d}</li>
        ))}
      </ul>
      <input type="file" onChange={e => setFile(e.target.files?.[0] || null)} />
      <button className="ml-2" onClick={upload}>Upload</button>
    </div>
  );
}
