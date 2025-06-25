"use client";

export default function Billing() {
  async function startSession() {
    await fetch('/api/org/billing-session');
    alert('Billing session started');
  }

  return (
    <div>
      <h2 className="text-xl mb-4 font-semibold">Billing</h2>
      <button className="bg-blue-600 text-white px-3 py-1 rounded" onClick={startSession}>
        Start Session
      </button>
    </div>
  );
}
