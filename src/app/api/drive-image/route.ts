import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

// Drive client authenticated with the same service account used for Sheets.
// The service account must have access to the Drive files (shared with its email).
function getDriveClient() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error('Missing GOOGLE_SERVICE_ACCOUNT_JSON');
  const key = JSON.parse(raw) as { client_email: string; private_key: string };
  const auth = new google.auth.JWT({
    email: key.client_email,
    key: key.private_key,
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });
  return google.drive({ version: 'v3', auth });
}

// GET /api/drive-image?id={driveFileId}
// Fetches the file from Drive using service account credentials and proxies it.
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id');

  // Validate: only allow alphanumeric + Drive-safe chars
  if (!id || !/^[a-zA-Z0-9_-]+$/.test(id)) {
    return new NextResponse('Invalid file ID', { status: 400 });
  }

  try {
    const drive = getDriveClient();

    const response = await drive.files.get(
      { fileId: id, alt: 'media' },
      { responseType: 'arraybuffer' },
    );

    const contentType =
      (response.headers as Record<string, string>)['content-type'] || 'image/jpeg';

    if (!contentType.startsWith('image/')) {
      return new NextResponse('Not an image', { status: 400 });
    }

    return new NextResponse(response.data as ArrayBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (err: unknown) {
    const status = (err as { status?: number }).status ?? 500;
    return new NextResponse('Failed to fetch image', { status });
  }
}
