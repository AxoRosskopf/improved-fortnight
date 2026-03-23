import { NextRequest, NextResponse } from 'next/server';
import { appendLog } from '@/lib/google-sheets-write';
import type { LogEntry } from '@/lib/types';

// ---------------------------------------------------------------------------
// POST /api/logs — append a log entry to the "Logs" tab
// Body: { spreadsheetId: string; entry: LogEntry }
// Returns: { ok: true }
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { spreadsheetId, entry } = body as { spreadsheetId: string; entry: LogEntry };

    if (!spreadsheetId || !entry) {
      return NextResponse.json({ error: 'Faltan campos requeridos: spreadsheetId, entry.' }, { status: 400 });
    }

    await appendLog(spreadsheetId, entry);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[POST /api/logs]', err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
