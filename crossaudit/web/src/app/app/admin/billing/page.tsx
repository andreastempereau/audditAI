"use client";

export default function Billing() {
  async function startSession() {
    await fetch('/api/org/billing-session');
    alert('Billing session started');
  }

  return (
    <div>
<<<<<<< codex/enhance-and-complete-web-app
=======
<<<<<<< vlw2xb-codex/enhance-and-complete-web-app
>>>>>>> main
      <h2 className="text-xl mb-4 font-semibold">Billing</h2>
      <button className="bg-blue-600 text-white px-3 py-1 rounded" onClick={startSession}>
        Start Session
      </button>
<<<<<<< codex/enhance-and-complete-web-app
=======
=======
      <h2 className="text-xl mb-2">Billing</h2>
      <button onClick={startSession}>Start Session</button>
>>>>>>> main
>>>>>>> main
    </div>
  );
}
