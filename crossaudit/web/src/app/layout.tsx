"use client";
import Toast from '../components/Toast';
import { useState } from 'react';
import { useAlerts } from '../lib/useAlerts';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [msg, setMsg] = useState('');
  useAlerts(setMsg);
  return (
    <html>
      <body>
        {children}
        <Toast message={msg} />
      </body>
    </html>
  );
}
