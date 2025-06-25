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
<<<<<<< vlw2xb-codex/enhance-and-complete-web-app
      <h2 className="text-xl mb-4 font-semibold">Documents</h2>
      <ul className="space-y-1 mb-4">
        {docs.map(d => (
          <li key={d} className="border rounded p-2 bg-white flex justify-between">
            <span>{d}</span>
            <a href={`/api/docs/${d}`} className="text-blue-600 hover:underline">View</a>
          </li>
        ))}
      </ul>
      <div className="space-x-2">
        <input type="file" onChange={e => setFile(e.target.files?.[0] || null)} />
        <button className="bg-blue-600 text-white px-3 py-1 rounded" onClick={upload}>Upload</button>
      </div>
=======
      <h2 className="text-xl mb-2">Documents</h2>
      <ul className="list-disc ml-6 mb-4">
        {docs.map(d => (
          <li key={d}>{d}</li>
        ))}
      </ul>
      <input type="file" onChange={e => setFile(e.target.files?.[0] || null)} />
      <button className="ml-2" onClick={upload}>Upload</button>
>>>>>>> main
    </div>
  );
}
