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

import SheetRenderer from '@/components/inventory/SheetRenderer';
import { fetchSheetData } from '@/lib/google-sheets';
import type { Metadata } from 'next';

// ---------------------------------------------------------------------------
// Dynamic metadata
// ---------------------------------------------------------------------------

// In Next.js 15, `params` is a Promise — must be awaited before use.
export async function generateMetadata(): Promise<Metadata> {
  return { title: `Inventario` };
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

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

  return <SheetRenderer sheets={nonEmpty} sheetId={sheetId} />;
}
