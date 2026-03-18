import { NextRequest, NextResponse } from 'next/server';
import { appendRow, updateRow, deleteRow } from '@/lib/google-sheets-write';
import type { InventoryItem } from '@/lib/types';
import type { CsvFormat } from '@/lib/csv-parser';

// ---------------------------------------------------------------------------
// POST /api/items — create (append) a new row
// Body: { spreadsheetId, sheetName, item, format }
// Returns: { ok: true, rowIndex: number }
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { spreadsheetId, sheetName, item, format } = body as {
      spreadsheetId: string;
      sheetName: string;
      item: InventoryItem;
      format: CsvFormat;
    };

    if (!spreadsheetId || !sheetName || !item || !format) {
      return NextResponse.json({ error: 'Faltan campos requeridos: spreadsheetId, sheetName, item, format.' }, { status: 400 });
    }

    const rowIndex = await appendRow(spreadsheetId, sheetName, item, format);
    return NextResponse.json({ ok: true, rowIndex });
  } catch (err) {
    console.error('[POST /api/items]', err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PUT /api/items — update an existing row
// Body: { spreadsheetId, sheetName, rowIndex, item, format }
// Returns: { ok: true }
// ---------------------------------------------------------------------------
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { spreadsheetId, sheetName, rowIndex, item, format } = body as {
      spreadsheetId: string;
      sheetName: string;
      rowIndex: number;
      item: InventoryItem;
      format: CsvFormat;
    };

    if (!spreadsheetId || !sheetName || !rowIndex || !item || !format) {
      return NextResponse.json({ error: 'Faltan campos requeridos: spreadsheetId, sheetName, rowIndex, item, format.' }, { status: 400 });
    }

    await updateRow(spreadsheetId, sheetName, rowIndex, item, format);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[PUT /api/items]', err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/items — delete a row
// Body: { spreadsheetId, sheetName, rowIndex }
// Returns: { ok: true }
// ---------------------------------------------------------------------------
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { spreadsheetId, sheetName, rowIndex } = body as {
      spreadsheetId: string;
      sheetName: string;
      rowIndex: number;
    };

    if (!spreadsheetId || !sheetName || !rowIndex) {
      return NextResponse.json({ error: 'Faltan campos requeridos: spreadsheetId, sheetName, rowIndex.' }, { status: 400 });
    }

    await deleteRow(spreadsheetId, sheetName, rowIndex);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[DELETE /api/items]', err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
