'use client';

import { createContext, useState, useCallback, type ReactNode } from 'react';
import styles from './Toast.module.css';

export type ToastType = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

export interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void;
}

export const ToastContext = createContext<ToastContextValue | null>(null);

let nextId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const toast = useCallback((message: string, type: ToastType = 'info') => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className={styles.container}>
        {toasts.map((t) => (
          <div key={t.id} className={styles.toast} data-type={t.type}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
