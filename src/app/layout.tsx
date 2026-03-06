import type { Metadata } from 'next';
import './globals.css';
import AppLayout from '@/components/layout/AppLayout';
import { ToastProvider } from '@/components/ui/Toast';

export const metadata: Metadata = {
  title: 'Inventary',
  description: 'Professional inventory management',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <ToastProvider>
          <AppLayout>{children}</AppLayout>
        </ToastProvider>
      </body>
    </html>
  );
}
