"use client";
import { useState, useRef, useEffect } from 'react';
import Spinner from '../components/Spinner';

interface Msg { prompt: string; response: string }

export default function Chat() {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function send() {
    if (!prompt.trim()) return;
    setLoading(true);
    const r = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    }).then(r => r.json());
    setMessages([...messages, { prompt, response: r.response }]);
    setPrompt('');
    setLoading(false);
  }

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex-1 overflow-y-auto space-y-2 bg-white p-4 rounded shadow">
        {messages.map((m, i) => (
          <div key={i} className="space-y-1 animate-fadeIn">
            <div className="bg-gray-100 p-2 rounded-md max-w-sm">{m.prompt}</div>
            <div className="bg-blue-100 p-2 rounded-md max-w-sm ml-auto">{m.response}</div>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <div className="flex items-end space-x-2">
        <textarea
          className="w-full border p-2 rounded resize-none"
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          rows={2}
        />
        <button
          className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
          onClick={send}
          disabled={loading}
        >
          {loading ? <Spinner /> : 'Send'}
        </button>
      </div>
    </div>
  );
}
