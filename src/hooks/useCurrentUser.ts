'use client';

import { useState, useEffect, useCallback } from 'react';

export function useCurrentUser() {
  const [userName, setUserName] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setUserName(localStorage.getItem('inventoryUser'));
    setIsLoaded(true);
  }, []);

  const register = useCallback((name: string) => {
    const trimmed = name.trim();
    localStorage.setItem('inventoryUser', trimmed);
    setUserName(trimmed);
  }, []);

  return { userName, isLoaded, register };
}
