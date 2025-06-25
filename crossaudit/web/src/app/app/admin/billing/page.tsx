"use client";

export default function Billing() {
  async function startSession() {
    await fetch('/api/org/billing-session');
    alert('Billing session started');
  }

  return (
    <div>
<<<<<<< vlw2xb-codex/enhance-and-complete-web-app
      <h2 className="text-xl mb-4 font-semibold">Billing</h2>
      <button className="bg-blue-600 text-white px-3 py-1 rounded" onClick={startSession}>
        Start Session
      </button>
=======
      <h2 className="text-xl mb-2">Billing</h2>
      <button onClick={startSession}>Start Session</button>
>>>>>>> main
    </div>
  );
}
