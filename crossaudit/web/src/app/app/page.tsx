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
      <textarea value={prompt} onChange={e => setPrompt(e.target.value)} />
      <button onClick={send}>Send</button>
      <pre>{resp}</pre>
    </div>
  );
}
