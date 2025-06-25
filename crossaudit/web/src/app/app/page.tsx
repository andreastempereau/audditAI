"use client";
import { useState } from 'react';

export default function Chat() {
  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState<{ prompt: string; response: string }[]>([]);

  async function send() {
    const r = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    }).then(r => r.json());
    setMessages([...messages, { prompt, response: r.response }]);
    setPrompt('');
  }

  return (
    <div className="flex flex-col space-y-4">
      <div className="space-y-2">
        {messages.map((m, i) => (
          <div key={i} className="space-y-1">
            <div className="bg-gray-100 p-2 rounded-md self-start">{m.prompt}</div>
            <div className="bg-blue-100 p-2 rounded-md self-end">{m.response}</div>
          </div>
        ))}
      </div>
      <textarea
        className="w-full border p-2"
        value={prompt}
        onChange={e => setPrompt(e.target.value)}
      />
      <button className="self-end bg-blue-600 text-white px-4 py-1 rounded" onClick={send}>
        Send
      </button>
    </div>
  );
}
