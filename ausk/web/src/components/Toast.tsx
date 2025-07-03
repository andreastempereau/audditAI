import { useEffect, useState } from 'react';

export default function Toast({ message }: { message: string }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!message) return;
    setShow(true);
    const t = setTimeout(() => setShow(false), 4000);
    return () => clearTimeout(t);
  }, [message]);

  if (!show) return null;
  return (
    <div className="fixed bottom-4 right-4 bg-gray-800 text-white px-4 py-2 rounded shadow-lg transition-opacity duration-500 animate-fadeIn">
      {message}
    </div>
  );
}
