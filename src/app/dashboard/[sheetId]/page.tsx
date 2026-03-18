/**
 * /dashboard/[sheetId]
 *
 * React Server Component — fetches inventory data directly on the server from
 * a publicly published Google Sheet (CSV mode) and renders it using the
 * existing InventoryList / InventoryCard components.
 *
 * No client-side state or hooks are used. Data is cached via ISR
 * (next: { revalidate: 60 }) and refreshed server-side every 60 seconds.
 */

import InventoryView from '@/components/inventory/InventoryView';
import { fetchSheetData } from '@/lib/google-sheets';
import type { Metadata } from 'next';

// ---------------------------------------------------------------------------
// Dynamic metadata
// ---------------------------------------------------------------------------

// In Next.js 15, `params` is a Promise — must be awaited before use.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ sheetId: string }>;
}): Promise<Metadata> {
  const { sheetId } = await params;
  return { title: `Inventario — ${sheetId}` };
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default async function Page({
  params,
}: {
  params: Promise<{ sheetId: string }>;
}) {
  // Await params — required in Next.js 15 App Router
  const { sheetId } = await params;

  // Fetch + parse the CSV. Any error thrown here is caught by error.tsx.
  const items = await fetchSheetData(sheetId);

  if (items.length === 0) {
    return (
      <p style={{ color: '#aaa', padding: '1.5rem' }}>
        La hoja no contiene filas reconocidas. Verifica que las columnas se
        llamen <strong>Producto</strong>, <strong>Stock inicial sugerido</strong>{' '}
        y <strong>Precio de venta</strong>.
      </p>
    );
  }

  return <InventoryView initialItems={items} />;
}
