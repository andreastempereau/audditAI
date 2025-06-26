"use client";
import Toast from '../components/Toast';
import { useState } from 'react';
import { useAlerts } from '../lib/useAlerts';
import '../globals.css';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [msg, setMsg] = useState('');
  useAlerts(setMsg);
  return (
    <html lang="en">
      <head>
        <title>CrossAudit</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className="bg-gray-50 text-gray-900 min-h-screen flex flex-col">
        {children}
        <Toast message={msg} />
      </body>
    </html>
  );
}
