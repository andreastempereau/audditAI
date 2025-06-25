import { useState, useEffect } from 'react';

export function useAuth() {
  const [user, setUser] = useState<string | null>(null);
  useEffect(() => {
    setUser('demo-user');
  }, []);
  return { user };
}
