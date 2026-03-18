/**
 * Google Sheets write utilities using a Service Account.
 *
 * Requires the environment variable:
 *   GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","client_email":"...","private_key":"..."}
 *
 * The service account must be granted Editor access on the spreadsheet.
 */

import { google } from 'googleapis';
import type { InventoryItem } from '@/lib/types';
import type { CsvFormat } from '@/lib/csv-parser';

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

function getAuthClient() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    throw new Error(
      'Falta la variable de entorno GOOGLE_SERVICE_ACCOUNT_JSON. ' +
      'Crea un Service Account en Google Cloud Console, descarga el JSON y ' +
      'pégalo como una sola línea en .env.local.'
    );
  }

  const key = JSON.parse(raw);
  return new google.auth.JWT({
    email: key.client_email,
    key: key.private_key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

// ---------------------------------------------------------------------------
// Column mapping: InventoryItem → row values
// ---------------------------------------------------------------------------

/**
 * case-a (Electrónica):
 * Nombre | Cantidad | Precio de compra | Precio de venta | Foto | Ficha tecnica
 */
function itemToRowCaseA(item: InventoryItem): string[] {
  const cantidad = item.stock != null
    ? `${item.stock}${item.unit ? ` ${item.unit}` : ''}`
    : '';
  return [
    item.name ?? '',
    cantidad,
    item.purchasePrice != null ? String(item.purchasePrice) : '',
    item.salePrice != null ? String(item.salePrice) : '',
    item.imageUrl ?? '',
    item.techSheetUrl ?? '',
  ];
}

/**
 * case-b (Automotriz / Tapicería):
 * Categoría | Subcategoría | Producto | Aplicaciones/Especificación | UOM |
 * Stock inicial sugerido | Punto de reorden | Notas | Foto | Ficha tecnica |
 * Precio de compra | Precio de venta | Link de video
 */
function itemToRowCaseB(item: InventoryItem): string[] {
  return [
    item.category ?? '',                                              // A: Categoría
    item.subcategory ?? '',                                           // B: Subcategoría
    item.name ?? '',                                                  // C: Producto
    item.description ?? '',                                           // D: Aplicaciones/Especificación
    item.unit ?? '',                                                  // E: UOM
    item.stock != null ? String(item.stock) : '',                    // F: Stock inicial sugerido
    item.reorderPoint != null ? String(item.reorderPoint) : '',      // G: Punto de reorden
    item.notes ?? '',                                                 // H: Notas
    item.imageUrl ?? '',                                              // I: Foto
    item.techSheetUrl ?? '',                                          // J: Ficha tecnica
    item.purchasePrice != null ? String(item.purchasePrice) : '',    // K: Precio de compra
    item.salePrice != null ? String(item.salePrice) : '',            // L: Precio de venta
    item.videoUrl ?? '',                                              // M: Link de video
  ];
}

function itemToRow(item: InventoryItem, format: CsvFormat): string[] {
  return format === 'case-a' ? itemToRowCaseA(item) : itemToRowCaseB(item);
}

/** Last column letter for each format (A=1, B=2, …, M=13) */
const LAST_COL: Record<CsvFormat, string> = {
  'case-a': 'F',  // 6 columns
  'case-b': 'M',  // 13 columns
  'unknown': 'Z',
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Appends a new item as the last row of the given sheet tab.
 * Returns the 1-based row index where the item was appended.
 */
export async function appendRow(
  spreadsheetId: string,
  sheetName: string,
  item: InventoryItem,
  format: CsvFormat,
): Promise<number> {
  const auth = getAuthClient();
  const sheets = google.sheets({ version: 'v4', auth });

  const values = [itemToRow(item, format)];

  const res = await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `'${sheetName}'!A:A`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values },
  });

  // Parse the updated range (e.g. "'Automotriz'!A15:L15") to extract row number
  const updatedRange = res.data.updates?.updatedRange ?? '';
  const match = updatedRange.match(/:?[A-Z]+(\d+)$/);
  return match ? parseInt(match[1], 10) : 0;
}

/**
 * Overwrites the cells in a specific row with the item's current values.
 */
export async function updateRow(
  spreadsheetId: string,
  sheetName: string,
  rowIndex: number,
  item: InventoryItem,
  format: CsvFormat,
): Promise<void> {
  const auth = getAuthClient();
  const sheets = google.sheets({ version: 'v4', auth });

  const lastCol = LAST_COL[format];
  const range = `'${sheetName}'!A${rowIndex}:${lastCol}${rowIndex}`;

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [itemToRow(item, format)] },
  });
}

/**
 * Deletes the entire row at `rowIndex` (1-based) from the sheet.
 * Uses batchUpdate + deleteDimension (requires the numeric sheetId, not the name).
 */
export async function deleteRow(
  spreadsheetId: string,
  sheetName: string,
  rowIndex: number,
): Promise<void> {
  const auth = getAuthClient();
  const sheets = google.sheets({ version: 'v4', auth });

  // Resolve sheet name → numeric sheetId
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const sheetMeta = meta.data.sheets?.find(
    (s) => s.properties?.title === sheetName,
  );
  if (sheetMeta?.properties?.sheetId == null) {
    throw new Error(`No se encontró la hoja "${sheetName}" en el spreadsheet.`);
  }
  const sheetId = sheetMeta.properties.sheetId;

  // deleteDimension uses 0-based startIndex, endIndex is exclusive
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId,
              dimension: 'ROWS',
              startIndex: rowIndex - 1,
              endIndex: rowIndex,
            },
          },
        },
      ],
    },
  });
}
