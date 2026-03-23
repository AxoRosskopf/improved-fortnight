/**
 * /dashboard/[sheetId]
 *
 * React Server Component — fetches all sheets from a publicly published
 * Google Spreadsheet and renders each one with the appropriate component
 * based on its detected column format (case-a or case-b).
 *
 * Data is cached via ISR (next: { revalidate: 60 }) and refreshed
 * server-side every 60 seconds.
 */

import InventoryView from '@/components/inventory/InventoryView';
import { fetchSheetData } from '@/lib/google-sheets';
import type { Metadata } from 'next';

export async function generateMetadata(): Promise<Metadata> {
  return { title: `Inventario` };
}

export default async function Page({
  params,
}: {
  params: Promise<{ sheetId: string }>;
}) {
  const { sheetId } = await params;

  const sheets = await fetchSheetData(sheetId);
  const nonEmpty = sheets.filter((s) => s.items.length > 0);

  if (nonEmpty.length === 0) {
    return (
      <p style={{ color: '#aaa', padding: '1.5rem' }}>
        La hoja no contiene filas reconocidas. Verifica que las columnas se
        llamen <strong>Producto</strong> o <strong>Nombre</strong>.
      </p>
    );
  }

  const allItems = nonEmpty.flatMap((s) => s.items);
  return <InventoryView initialItems={allItems} sheetId={sheetId} />;
}
