import Papa from 'papaparse';
import type { InventoryItem } from '@/lib/types';
import { parseRows } from '@/lib/csv-parser';

// ---------------------------------------------------------------------------
// Fetch + Parse
// ---------------------------------------------------------------------------

// /gviz/tq works with "Anyone with the link can view" sharing — no API key needed.
// /export?format=csv requires "Publish to web", which is a separate extra step.
const csvUrl = (sheetId: string) =>
  `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv`;

/**
 * Fetches a Google Sheet shared as "Anyone with the link can view" and returns
 * fully typed InventoryItem[]. Delegates parsing to the existing parseRows()
 * utility which supports both Case A (Nombre/Cantidad) and Case B
 * (Producto/Categoría/UOM/Stock inicial sugerido/Precio de compra…).
 *
 * Caching: Next.js ISR — revalidated server-side every 60 s without redeploy.
 *
 * @throws {Error} on HTTP failure — caught by the nearest error.tsx boundary.
 */
export async function fetchSheetData(sheetId: string): Promise<InventoryItem[]> {
  const res = await fetch(csvUrl(sheetId), {
    next: { revalidate: 60 },
  });

  if (!res.ok) {
    throw new Error(
      `No se pudo obtener la hoja (HTTP ${res.status}). ` +
        'Verifica que el documento sea accesible: ' +
        'Compartir → Cualquiera con el enlace → Lector.'
    );
  }

  const csv = await res.text();

  // Trim headers only — keep original case so parseRows() can match column
  // names like "Producto", "Categoría", "Precio de compra ", etc.
  const { data, errors: parseErrors } = Papa.parse<Record<string, string>>(csv, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  if (parseErrors.length > 0) {
    console.warn('[google-sheets] PapaParse warnings:', parseErrors);
  }

  // Reuse the existing csv-parser logic (auto-detects Case A / Case B format)
  const { products, errors } = parseRows(data);

  if (errors.length > 0) {
    console.warn('[google-sheets] Row mapping errors:', errors);
  }

  return products;
}

// ---------------------------------------------------------------------------
// PRODUCCIÓN — Migrar a la SDK oficial (googleapis) con Service Account
// ---------------------------------------------------------------------------
//
// Cuando la hoja sea privada, reemplaza fetchSheetData con lo siguiente:
//
//   import { google } from 'googleapis';
//
//   const auth = new google.auth.GoogleAuth({
//     credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON!),
//     scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
//   });
//   const sheets = google.sheets({ version: 'v4', auth });
//
//   export async function fetchSheetData(sheetId: string): Promise<SheetRow[]> {
//     const { data } = await sheets.spreadsheets.values.get({
//       spreadsheetId: sheetId,
//       range: 'A:C',   // columnas: Nombre | Stock | Precio
//     });
//     const [_header, ...rows] = data.values ?? [];
//     return (rows as string[][]).map(([nombre = '', stock = '0', precio = '0']) => ({
//       nombre: nombre.trim(),
//       stock: parseFloat(stock) || 0,
//       precio: parseFloat(precio.replace(/[^0-9.]/g, '')) || 0,
//     }));
//   }
//
// Instrucciones:
//   1. Crea un Service Account en Google Cloud Console.
//   2. Comparte la hoja con el email del Service Account (solo lectura).
//   3. Descarga el JSON de credenciales y guárdalo como variable de entorno:
//        GOOGLE_SERVICE_ACCOUNT_JSON='{"type":"service_account",...}'
//   4. Instala la SDK: pnpm add googleapis
// ---------------------------------------------------------------------------
