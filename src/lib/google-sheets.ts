import { google } from 'googleapis';
import type { InventoryItem, LogEntry } from '@/lib/types';
import { parseRows, detectFormat } from '@/lib/csv-parser';
import type { CsvFormat } from '@/lib/csv-parser';
import { sanitizeDriveUrl } from '@/lib/url-utils';

// ---------------------------------------------------------------------------
// Auth (Service Account — same credentials as write operations)
// ---------------------------------------------------------------------------

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
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  return _authClient;
}

// ---------------------------------------------------------------------------
// Types (minimal — only the fields we read)
// ---------------------------------------------------------------------------

interface ExtendedValue {
  stringValue?: string;
  numberValue?: number;
  formulaValue?: string;
}

interface CellData {
  userEnteredValue?: ExtendedValue;
  effectiveValue?: ExtendedValue;
}

interface RowData {
  values?: CellData[];
}

interface GridData {
  rowData?: RowData[];
}

interface SheetProperties {
  title?: string;
}

interface Sheet {
  properties?: SheetProperties;
  data?: GridData[];
}

interface SheetsApiResponse {
  sheets?: Sheet[];
}

export interface SheetData {
  sheetName: string;
  format: CsvFormat;
  items: InventoryItem[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const IMAGE_FORMULA_RE = /^=IMAGE\("([^"]+)"/i;

/** Extracts the best string representation of a cell, image URLs included. */
function cellValue(cell: CellData | undefined): string {
  if (!cell) return '';

  // 1. =IMAGE("url") formula
  const formula = cell.userEnteredValue?.formulaValue ?? '';
  const imageMatch = formula.match(IMAGE_FORMULA_RE);
  if (imageMatch) {
    return sanitizeDriveUrl(imageMatch[1]) || imageMatch[1];
  }

  // 3. Normal string / number value
  const sv = cell.effectiveValue?.stringValue;
  if (sv !== undefined) return sv;

  const nv = cell.effectiveValue?.numberValue;
  if (nv !== undefined) return String(nv);

  return '';
}

// ---------------------------------------------------------------------------
// Main fetch
// ---------------------------------------------------------------------------

// Request cell values + sheet titles.
// Omits formatting, borders, colors, etc.
const FIELDS =
  'sheets.properties.title,' +
  'sheets.data.rowData.values(effectiveValue,userEnteredValue)';

/**
 * Fetches log entries from the "Logs" tab of a Google Spreadsheet.
 * Returns entries sorted newest-first. Returns [] if the tab doesn't exist.
 */
export async function fetchLogs(sheetId: string): Promise<LogEntry[]> {
  try {
    const auth = getAuthClient();
    const sheets = google.sheets({ version: 'v4', auth });

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `'Logs'!A:E`,
    });

    const rows = res.data.values ?? [];
    const dataRows = rows.length > 0 && rows[0][0] === 'Fecha y hora' ? rows.slice(1) : rows;

    const entries: LogEntry[] = dataRows
      .filter((row) => row.length >= 5)
      .map((row) => ({
        timestamp: row[0] ?? '',
        userName: row[1] ?? '',
        action: row[2] as LogEntry['action'],
        itemName: row[3] ?? '',
        sheetName: row[4] ?? '',
      }));

    return entries.reverse(); // newest-first
  } catch {
    return [];
  }
}

/**
 * Fetches all sheets from a Google Spreadsheet using the Sheets API v4
 * authenticated via Service Account. Returns one SheetData entry per tab,
 * each with its name, detected format (case-a / case-b / unknown), and
 * parsed items.
 *
 * Requires GOOGLE_SERVICE_ACCOUNT_JSON in your environment (server-side only).
 * The Service Account must have at least Viewer access on the spreadsheet.
 *
 * @throws {Error} on API failure or missing credentials.
 */
export async function fetchSheetData(sheetId: string): Promise<SheetData[]> {
  const auth = getAuthClient();
  const sheets = google.sheets({ version: 'v4', auth });

  let spreadsheet;
  try {
    const res = await sheets.spreadsheets.get({
      spreadsheetId: sheetId,
      includeGridData: true,
      fields: FIELDS,
    });
    spreadsheet = res.data;
  } catch (err: unknown) {
    const code = (err as { code?: number }).code;
    throw new Error(
      `Sheets API respondió HTTP ${code ?? '?'}. ` +
        'Verifica que el Service Account tenga acceso a la hoja (al menos Lector).'
    );
  }

  const json: SheetsApiResponse = spreadsheet as SheetsApiResponse;

  const result: SheetData[] = [];

  for (const sheet of json.sheets ?? []) {
    const sheetName = sheet.properties?.title ?? 'Sin nombre';

    if (sheetName === 'Logs') continue; // reserved for activity log — rendered only on /logs

    const rowData = sheet.data?.[0]?.rowData ?? [];

    if (rowData.length < 2) continue; // skip empty or header-only sheets

    // Scan for the first row that has a recognized format — some sheets have
    // a title row (e.g. "Ingreso de inventario...") before the actual headers.
    let headerRowIdx = -1;
    let headers: string[] = [];
    for (let i = 0; i < rowData.length; i++) {
      const candidate = (rowData[i].values ?? []).map((c) => cellValue(c).trim());
      if (detectFormat(candidate) !== 'unknown') {
        headers = candidate;
        headerRowIdx = i;
        break;
      }
    }

    if (headerRowIdx === -1) continue; // no recognized header row in this sheet

    // Track absolute 1-based row numbers before filtering empty rows
    const rowsWithIndex = rowData
      .slice(headerRowIdx + 1)
      .map((row, localIdx) => ({
        row,
        sheetRowIndex: headerRowIdx + 2 + localIdx, // 1-based sheet row number
      }))
      .filter(({ row }) => (row.values ?? []).some((c) => cellValue(c).trim() !== ''));

    const rows: Record<string, string>[] = rowsWithIndex.map(({ row }) => {
      const values = row.values ?? [];
      const record: Record<string, string> = {};
      headers.forEach((header, i) => {
        if (header) record[header] = cellValue(values[i]);
      });
      return record;
    });

    const rowIndices = rowsWithIndex.map(({ sheetRowIndex }) => sheetRowIndex);

    const { products, errors } = parseRows(rows, { rowIndices, sheetName });

    if (errors.length > 0) {
      console.warn(`[google-sheets] "${sheetName}" row errors:`, errors);
    }

    const format = detectFormat(headers);
    result.push({ sheetName, format, items: products });
  }

  return result;
}
