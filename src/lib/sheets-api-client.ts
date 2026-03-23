import type { InventoryItem, LogEntry } from './types';
import type { CsvFormat } from './csv-parser';

async function apiCall(method: string, body: unknown): Promise<unknown> {
  const res = await fetch('/api/items', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error ?? `Error ${res.status}`);
  }
  return res.json();
}

export async function createSheetItem(
  spreadsheetId: string,
  sheetName: string,
  item: InventoryItem,
  format: CsvFormat,
): Promise<{ rowIndex: number }> {
  return apiCall('POST', { spreadsheetId, sheetName, item, format }) as Promise<{ rowIndex: number }>;
}

export async function updateSheetItem(
  spreadsheetId: string,
  sheetName: string,
  rowIndex: number,
  item: InventoryItem,
  format: CsvFormat,
): Promise<void> {
  await apiCall('PUT', { spreadsheetId, sheetName, rowIndex, item, format });
}

export async function deleteSheetItem(
  spreadsheetId: string,
  sheetName: string,
  rowIndex: number,
): Promise<void> {
  await apiCall('DELETE', { spreadsheetId, sheetName, rowIndex });
}

/** Fire-and-forget log write. Never throws. */
export async function createLog(spreadsheetId: string, entry: LogEntry): Promise<void> {
  try {
    await fetch('/api/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ spreadsheetId, entry }),
    });
  } catch {
    // silently fail
  }
}
