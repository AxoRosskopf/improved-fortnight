/**
 * Google Drive upload utilities using a Service Account.
 *
 * Requires GOOGLE_SERVICE_ACCOUNT_JSON (same key used for Sheets).
 * Optional DRIVE_FOLDER_NAME (default: "Inventario") — folder is auto-created
 * if it does not exist.
 *
 * Scope: drive.file — access only to files created by this app.
 * Files are NOT shared with anyone; only the service account can read them
 * (served via /api/drive-image proxy).
 */

import { google } from 'googleapis';
import { Readable } from 'stream';

// ---------------------------------------------------------------------------
// Module-level singletons (survive warm function instances)
// ---------------------------------------------------------------------------

let _authClient: InstanceType<typeof google.auth.JWT> | null = null;
let _folderId: string | null = null;

function getAuthClient() {
  if (_authClient) return _authClient;
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    throw new Error(
      'Falta la variable de entorno GOOGLE_SERVICE_ACCOUNT_JSON.',
    );
  }
  const key = JSON.parse(raw) as { client_email: string; private_key: string };
  _authClient = new google.auth.JWT({
    email: key.client_email,
    key: key.private_key,
    scopes: ['https://www.googleapis.com/auth/drive.file'],
  });
  return _authClient;
}

/** @internal — resets cached singletons. Only for use in tests. */
export function _resetCache() {
  _authClient = null;
  _folderId = null;
}

// ---------------------------------------------------------------------------
// File naming
// ---------------------------------------------------------------------------

/**
 * Generates a Drive filename from inventory metadata.
 * Format: {categoria}_{nombre-producto}_{8-char-uuid}.{ext}
 * Example: automotriz_filtro-de-aceite_a1b2c3d4.jpg
 */
export function buildFileName(
  category: string,
  name: string,
  originalName: string,
): string {
  function sanitize(s: string): string {
    const clean = s
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // strip accent marks
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    return clean || 'sin-valor';
  }

  const lastDot = originalName.lastIndexOf('.');
  const ext =
    lastDot >= 0 ? '.' + originalName.slice(lastDot + 1).toLowerCase() : '.jpg';

  const shortId = crypto.randomUUID().slice(0, 8);
  return `${sanitize(category)}_${sanitize(name)}_${shortId}${ext}`;
}

// ---------------------------------------------------------------------------
// Folder management
// ---------------------------------------------------------------------------

/**
 * Returns the Drive folder ID for the given name.
 * Searches for an existing folder first; creates one if not found.
 * Result is cached for the lifetime of the warm function instance.
 */
export async function getOrCreateFolder(name: string): Promise<string> {
  if (_folderId) return _folderId;

  // If DRIVE_FOLDER_ID is set, use the pre-existing shared folder directly.
  // Service accounts have no Drive storage quota of their own — files must be
  // uploaded into a folder owned by a real Google account that has been shared
  // with the service account as Editor.
  if (process.env.DRIVE_FOLDER_ID) {
    _folderId = process.env.DRIVE_FOLDER_ID;
    return _folderId;
  }

  const auth = getAuthClient();
  const drive = google.drive({ version: 'v3', auth });

  const listRes = await drive.files.list({
    q: `name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id)',
    spaces: 'drive',
  });

  const files = listRes.data.files ?? [];
  if (files.length > 0 && files[0].id) {
    _folderId = files[0].id;
    return _folderId;
  }

  const createRes = await drive.files.create({
    requestBody: {
      name,
      mimeType: 'application/vnd.google-apps.folder',
    },
    fields: 'id',
    supportsAllDrives: true,
  });

  if (!createRes.data.id) {
    throw new Error('Drive no devolvió ID al crear la carpeta.');
  }
  _folderId = createRes.data.id;
  return _folderId;
}

// ---------------------------------------------------------------------------
// File upload
// ---------------------------------------------------------------------------

/**
 * Uploads a file buffer to the company Drive folder.
 * The file is owned by the service account and not shared (restricted access).
 * Use /api/drive-image to serve images through the proxy.
 */
export async function uploadFileToDrive({
  buffer,
  mimeType,
  fileName,
}: {
  buffer: Buffer;
  mimeType: string;
  fileName: string;
}): Promise<{ id: string; driveUrl: string }> {
  const folderName = process.env.DRIVE_FOLDER_NAME ?? 'Inventario';
  const folderId = await getOrCreateFolder(folderName);

  const auth = getAuthClient();
  const drive = google.drive({ version: 'v3', auth });

  const res = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [folderId],
    },
    media: {
      mimeType,
      body: Readable.from(buffer),
    },
    fields: 'id',
    // Required when the target folder is a Shared Drive.
    // Files in Shared Drives are owned by the drive (no service account quota needed).
    supportsAllDrives: true,
  });

  const id = res.data.id;
  if (!id) throw new Error('Drive no devolvió ID del archivo subido.');

  return {
    id,
    driveUrl: `https://drive.google.com/file/d/${id}/view`,
  };
}
