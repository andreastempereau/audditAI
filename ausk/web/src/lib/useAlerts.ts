import { useEffect } from 'react';

export function useAlerts(callback: (msg: string) => void) {
  useEffect(() => {
    const es = new EventSource('/api/alerts');
    es.onmessage = e => {
      try {
        const data = JSON.parse(e.data);
        // Don't show heartbeat or connection messages
        if (data.type === 'heartbeat' || data.type === 'connected') {
          return;
        }
        // Only show actual alert messages
        if (data.message) {
          callback(data.message);
        }
      } catch (error) {
        // If it's not JSON, show the raw message
        callback(e.data);
      }
    };
    return () => es.close();
  }, [callback]);
}
