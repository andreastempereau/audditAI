import { useEffect } from 'react';

export function useAlerts(callback: (msg: string) => void) {
  useEffect(() => {
    const es = new EventSource('/api/alerts');
    es.onmessage = e => callback(e.data);
    return () => es.close();
  }, [callback]);
}
