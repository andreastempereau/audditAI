"use client";
import { useState } from 'react';

export default function Chat() {
  const [prompt, setPrompt] = useState('');
  const [resp, setResp] = useState('');

  async function send() {
    const r = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    }).then(r => r.json());
    setResp(r.response);
  }

  return (
    <div>
      <textarea
        className="w-full border p-2"
        value={prompt}
        onChange={e => setPrompt(e.target.value)}
      />
      <button className="mt-2" onClick={send}>Send</button>
      <pre className="mt-4 whitespace-pre-wrap">{resp}</pre>
    </div>
  );
}
