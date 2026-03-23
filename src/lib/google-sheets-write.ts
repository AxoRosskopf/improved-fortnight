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
import type { LogEntry } from '@/lib/types';
import type { CsvFormat } from '@/lib/csv-parser';

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

// Module-level singleton: reused across calls within the same warm instance.
let _authClient: InstanceType<typeof google.auth.JWT> | null = null;

function getAuthClient() {
  if (_authClient) return _authClient;

  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    throw new Error(
      'Falta la variable de entorno GOOGLE_SERVICE_ACCOUNT_JSON. ' +
      'Crea un Service Account en Google Cloud Console, descarga el JSON y ' +
      'pégalo como una sola línea en .env.local.'
    );
  }

  const key = JSON.parse(raw);
  _authClient = new google.auth.JWT({
    email: key.client_email,
    key: key.private_key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return _authClient;
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
    item.shelf != null ? String(item.shelf) : '',   // G: Estante
    item.level != null ? String(item.level) : '',   // H: Nivel
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
    item.shelf != null ? String(item.shelf) : '',                    // N: Estante
    item.level != null ? String(item.level) : '',                    // O: Nivel
  ];
}

function itemToRow(item: InventoryItem, format: CsvFormat): string[] {
  return format === 'case-a' ? itemToRowCaseA(item) : itemToRowCaseB(item);
}

/** Last column letter for each format (A=1, B=2, …) — includes Estante + Nivel */
const LAST_COL: Record<CsvFormat, string> = {
  'case-a': 'H',  // 8 columns (A–F original + G:Estante + H:Nivel)
  'case-b': 'O',  // 15 columns (A–M original + N:Estante + O:Nivel)
  'unknown': 'Z',
};

/** Column letter for Estante and Nivel per format */
const LOCATION_COLS: Record<'case-a' | 'case-b', { estante: string; nivel: string }> = {
  'case-a': { estante: 'G', nivel: 'H' },
  'case-b': { estante: 'N', nivel: 'O' },
};

/**
 * Ensures "Estante" and "Nivel" headers exist in row 1 of the given sheet.
 * If missing, writes them at their expected column positions.
 * This is a no-op if the headers already exist.
 */
async function ensureLocationColumns(
  spreadsheetId: string,
  sheetName: string,
  format: CsvFormat,
  sheets: ReturnType<typeof google.sheets>,
): Promise<void> {
  if (format === 'unknown') return;

  const { estante, nivel } = LOCATION_COLS[format];
  const lastCol = LAST_COL[format];

  let existing: string[] = [];
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${sheetName}'!A1:${lastCol}1`,
    });
    existing = (res.data.values?.[0] ?? []) as string[];
  } catch {
    return;
  }

  if (!existing.includes('Estante')) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'${sheetName}'!${estante}1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [['Estante']] },
    });
  }

  if (!existing.includes('Nivel')) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'${sheetName}'!${nivel}1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [['Nivel']] },
    });
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Ensures the "Logs" tab exists with the correct headers.
 * Creates it if missing.
 */
async function ensureLogsSheet(
  spreadsheetId: string,
  sheets: ReturnType<typeof google.sheets>,
): Promise<void> {
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const exists = meta.data.sheets?.some((s) => s.properties?.title === 'Logs');
  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [{ addSheet: { properties: { title: 'Logs' } } }] },
    });
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'Logs'!A1:E1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [['Fecha y hora', 'Usuario', 'Acción', 'Producto', 'Hoja']] },
    });
  }
}

/**
 * Appends a log entry to the "Logs" tab.
 * Columns: A=Fecha y hora | B=Usuario | C=Acción | D=Producto | E=Hoja
 * Auto-creates the tab with headers if it doesn't exist yet.
 */
export async function appendLog(spreadsheetId: string, entry: LogEntry): Promise<void> {
  const auth = getAuthClient();
  const sheets = google.sheets({ version: 'v4', auth });
  const row = [[entry.timestamp, entry.userName, entry.action, entry.itemName, entry.sheetName]];
  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `'Logs'!A:E`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: row },
    });
  } catch {
    // Tab probably doesn't exist — try to create it, then always retry the append.
    // ensureLogsSheet is in its own try so that if a concurrent request already created
    // the tab (causing batchUpdate to throw), we still proceed to the retry append.
    try { await ensureLogsSheet(spreadsheetId, sheets); } catch { /* already exists or other transient error */ }
    try {
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `'Logs'!A:E`,
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values: row },
      });
    } catch {
      // Don't break the main operation if logging fails
    }
  }
}

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

  await ensureLocationColumns(spreadsheetId, sheetName, format, sheets);

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

  await ensureLocationColumns(spreadsheetId, sheetName, format, sheets);

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
