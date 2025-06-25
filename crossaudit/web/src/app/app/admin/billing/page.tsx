"use client";

export default function Billing() {
  async function startSession() {
    await fetch('/api/org/billing-session');
    alert('Billing session started');
  }

  return (
    <div>
      <h2 className="text-xl mb-2">Billing</h2>
      <button onClick={startSession}>Start Session</button>
    </div>
  );
}
