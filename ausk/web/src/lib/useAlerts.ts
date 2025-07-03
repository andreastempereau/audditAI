import { useEffect } from 'react';

export function useAlerts(callback: (msg: string) => void) {
  useEffect(() => {
    const es = new EventSource('/api/alerts');
    es.onmessage = e => {
      try {
        const data = JSON.parse(e.data);
        console.log('Alert received:', data); // Debug log
        
        // Don't show heartbeat or connection messages
        if (data.type === 'heartbeat' || data.type === 'connected') {
          console.log('Filtered out system message:', data.type);
          return;
        }
        
        // Only show actual alert messages
        if (data.message) {
          console.log('Showing alert:', data.message);
          callback(data.message);
        }
      } catch (error) {
        // If it's not JSON, don't show it either (to prevent showing raw JSON)
        console.log('Non-JSON message received:', e.data);
        // Don't call callback for raw data
      }
    };
    return () => es.close();
  }, [callback]);
}
