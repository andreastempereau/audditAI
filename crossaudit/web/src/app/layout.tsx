"use client";
import Toast from '../components/Toast';
import { useState } from 'react';
import { useAlerts } from '../lib/useAlerts';
<<<<<<< vlw2xb-codex/enhance-and-complete-web-app
import '../globals.css';
=======
>>>>>>> main

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [msg, setMsg] = useState('');
  useAlerts(setMsg);
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900">
        {children}
        <Toast message={msg} />
      </body>
    </html>
  );
}
