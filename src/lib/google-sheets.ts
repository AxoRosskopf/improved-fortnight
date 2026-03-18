import type { InventoryItem } from '@/lib/types';
import { parseRows, detectFormat } from '@/lib/csv-parser';
import type { CsvFormat } from '@/lib/csv-parser';
import { sanitizeDriveUrl } from '@/lib/url-utils';

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
// Omits formatting, borders, colors, etc. to stay under Next.js's 2MB cache limit.
const FIELDS =
  'sheets.properties.title,' +
  'sheets.data.rowData.values(effectiveValue,userEnteredValue)';

const apiUrl = (sheetId: string, apiKey: string) =>
  `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}` +
  `?includeGridData=true&fields=${FIELDS}&key=${apiKey}`;

/**
 * Fetches all sheets from a Google Spreadsheet (shared as "Anyone with the
 * link can view") using the Sheets API v4. Returns one SheetData entry per
 * tab, each with its name, detected format (case-a / case-b / unknown), and
 * parsed items.
 *
 * Requires GOOGLE_SHEETS_API_KEY in your environment (server-side only).
 * Caching: Next.js ISR — revalidated every 60 s without redeploy.
 *
 * @throws {Error} on HTTP failure or missing API key.
 */
export async function fetchSheetData(sheetId: string): Promise<SheetData[]> {
  const apiKey = process.env.GOOGLE_SHEETS_API_KEY;
  if (!apiKey) {
    throw new Error(
      'Falta la variable de entorno GOOGLE_SHEETS_API_KEY. ' +
        'Crea una API Key en Google Cloud Console con la Sheets API habilitada.'
    );
  }

  const res = await fetch(apiUrl(sheetId, apiKey), {
    next: { revalidate: 60 },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(
      `Sheets API respondió HTTP ${res.status}. ` +
        'Verifica que la hoja sea pública y que la API Key tenga la Sheets API habilitada. ' +
        (body ? `Detalle: ${body.slice(0, 200)}` : '')
    );
  }

  const json: SheetsApiResponse = await res.json();

  const result: SheetData[] = [];

  for (const sheet of json.sheets ?? []) {
    const sheetName = sheet.properties?.title ?? 'Sin nombre';
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
