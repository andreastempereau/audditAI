"use client";
import { useState } from 'react';
import Spinner from '../../../components/Spinner';

export default function Billing() {
  const [loading, setLoading] = useState(false);

  async function startSession() {
    setLoading(true);
    await fetch('/api/org/billing-session');
    setLoading(false);
    alert('Billing session started');
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Billing</h2>
      <button
        className="bg-blue-600 text-white px-3 py-1 rounded disabled:opacity-50"
        onClick={startSession}
        disabled={loading}
      >
        {loading ? <Spinner /> : 'Start Session'}
      </button>
    </div>
  );
}
