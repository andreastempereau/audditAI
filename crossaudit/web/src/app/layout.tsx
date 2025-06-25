import Toast from '../components/Toast';
import { useState } from 'react';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [msg, setMsg] = useState('');
  return (
    <html>
      <body>
        {children}
        <Toast message={msg} />
      </body>
    </html>
  );
}
