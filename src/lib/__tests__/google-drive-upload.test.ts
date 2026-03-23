import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mocks — must be defined before vi.mock() factory runs
// ---------------------------------------------------------------------------

const mockFilesList = vi.hoisted(() => vi.fn());
const mockFilesCreate = vi.hoisted(() => vi.fn());

vi.mock('googleapis', () => ({
  google: {
    auth: {
      // Must be a regular function (not arrow) so `new JWT(...)` works
      JWT: vi.fn(function () {}),
    },
    drive: vi.fn().mockReturnValue({
      files: {
        list: mockFilesList,
        create: mockFilesCreate,
      },
    }),
  },
}));

import {
  buildFileName,
  getOrCreateFolder,
  uploadFileToDrive,
  _resetCache,
} from '../google-drive-upload';

// ---------------------------------------------------------------------------
// Shared setup
// ---------------------------------------------------------------------------

const FAKE_KEY = JSON.stringify({
  client_email: 'test@example.iam.gserviceaccount.com',
  private_key: 'fake-private-key',
});

beforeEach(() => {
  _resetCache();
  vi.clearAllMocks();
  process.env.GOOGLE_SERVICE_ACCOUNT_JSON = FAKE_KEY;
});

afterEach(() => {
  delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  delete process.env.DRIVE_FOLDER_NAME;
});

// ---------------------------------------------------------------------------
// buildFileName — pure function, no API calls
// ---------------------------------------------------------------------------

describe('buildFileName', () => {
  it('strips accent marks', () => {
    const result = buildFileName('Electrónica', 'Sensor O2', 'foto.jpg');
    expect(result).toMatch(/^electronica_sensor-o2_[a-z0-9]{8}\.jpg$/);
  });

  it('converts spaces to hyphens', () => {
    const result = buildFileName('Automotriz', 'Filtro de aceite', 'img.jpg');
    expect(result).toMatch(/^automotriz_filtro-de-aceite_[a-z0-9]{8}\.jpg$/);
  });

  it('preserves the original extension', () => {
    const result = buildFileName('Cat', 'Name', 'photo.png');
    expect(result).toMatch(/\.png$/);
  });

  it('preserves webp extension', () => {
    const result = buildFileName('Cat', 'Name', 'image.webp');
    expect(result).toMatch(/\.webp$/);
  });

  it('defaults to .jpg when filename has no extension', () => {
    const result = buildFileName('Cat', 'Name', 'noext');
    expect(result).toMatch(/\.jpg$/);
  });

  it('uses fallback segment when category is empty', () => {
    const result = buildFileName('', 'Filtro', 'img.jpg');
    expect(result).toMatch(/^sin-valor_filtro_/);
  });

  it('uses fallback segment when name is empty', () => {
    const result = buildFileName('Automotriz', '', 'img.jpg');
    expect(result).toMatch(/^automotriz_sin-valor_/);
  });

  it('collapses repeated special chars into a single hyphen', () => {
    const result = buildFileName('A  &  B', 'Name', 'img.jpg');
    expect(result).toMatch(/^a-b_name_/);
  });

  it('generates a unique short ID on each call', () => {
    const a = buildFileName('Cat', 'Name', 'img.jpg');
    const b = buildFileName('Cat', 'Name', 'img.jpg');
    const idA = a.split('_')[2].split('.')[0];
    const idB = b.split('_')[2].split('.')[0];
    expect(idA).not.toBe(idB);
  });
});

// ---------------------------------------------------------------------------
// getOrCreateFolder
// ---------------------------------------------------------------------------

describe('getOrCreateFolder', () => {
  it('returns existing folder ID when Drive returns a match', async () => {
    mockFilesList.mockResolvedValueOnce({ data: { files: [{ id: 'abc123' }] } });

    const id = await getOrCreateFolder('Inventario');

    expect(id).toBe('abc123');
    expect(mockFilesCreate).not.toHaveBeenCalled();
  });

  it('creates a new folder when Drive returns no match and returns its ID', async () => {
    mockFilesList.mockResolvedValueOnce({ data: { files: [] } });
    mockFilesCreate.mockResolvedValueOnce({ data: { id: 'xyz789' } });

    const id = await getOrCreateFolder('Inventario');

    expect(id).toBe('xyz789');
    expect(mockFilesCreate).toHaveBeenCalledOnce();
    expect(mockFilesCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        requestBody: expect.objectContaining({
          name: 'Inventario',
          mimeType: 'application/vnd.google-apps.folder',
        }),
      }),
    );
  });

  it('caches the folder ID so Drive is only queried once', async () => {
    mockFilesList.mockResolvedValueOnce({ data: { files: [{ id: 'cached-id' }] } });

    await getOrCreateFolder('Inventario');
    const second = await getOrCreateFolder('Inventario');

    expect(second).toBe('cached-id');
    expect(mockFilesList).toHaveBeenCalledOnce();
  });

  it('uses DRIVE_FOLDER_ID env var directly without calling Drive API', async () => {
    process.env.DRIVE_FOLDER_ID = 'preset-folder-id';

    const id = await getOrCreateFolder('Inventario');

    expect(id).toBe('preset-folder-id');
    expect(mockFilesList).not.toHaveBeenCalled();
    expect(mockFilesCreate).not.toHaveBeenCalled();

    delete process.env.DRIVE_FOLDER_ID;
  });

  it('throws when folder creation returns no ID', async () => {
    mockFilesList.mockResolvedValueOnce({ data: { files: [] } });
    mockFilesCreate.mockResolvedValueOnce({ data: {} }); // no id

    await expect(getOrCreateFolder('Inventario')).rejects.toThrow(
      'Drive no devolvió ID al crear la carpeta.',
    );
  });
});

// ---------------------------------------------------------------------------
// uploadFileToDrive
// ---------------------------------------------------------------------------

describe('uploadFileToDrive', () => {
  it('returns correct id and driveUrl on success', async () => {
    mockFilesList.mockResolvedValueOnce({ data: { files: [{ id: 'folder1' }] } });
    mockFilesCreate.mockResolvedValueOnce({ data: { id: 'file1' } });

    const result = await uploadFileToDrive({
      buffer: Buffer.from('fake-image-content'),
      mimeType: 'image/jpeg',
      fileName: 'automotriz_filtro_a1b2c3d4.jpg',
    });

    expect(result.id).toBe('file1');
    expect(result.driveUrl).toBe('https://drive.google.com/file/d/file1/view');
  });

  it('passes the correct parent folder to files.create', async () => {
    mockFilesList.mockResolvedValueOnce({ data: { files: [{ id: 'folder-xyz' }] } });
    mockFilesCreate.mockResolvedValueOnce({ data: { id: 'file2' } });

    await uploadFileToDrive({
      buffer: Buffer.from('data'),
      mimeType: 'image/png',
      fileName: 'test.png',
    });

    expect(mockFilesCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        requestBody: expect.objectContaining({
          parents: ['folder-xyz'],
        }),
      }),
    );
  });

  it('uses DRIVE_FOLDER_NAME env var when set', async () => {
    process.env.DRIVE_FOLDER_NAME = 'MiCarpeta';
    mockFilesList.mockResolvedValueOnce({ data: { files: [{ id: 'f1' }] } });
    mockFilesCreate.mockResolvedValueOnce({ data: { id: 'f2' } });

    await uploadFileToDrive({
      buffer: Buffer.from('data'),
      mimeType: 'image/jpeg',
      fileName: 'test.jpg',
    });

    expect(mockFilesList).toHaveBeenCalledWith(
      expect.objectContaining({
        q: expect.stringContaining("name='MiCarpeta'"),
      }),
    );
  });

  it('defaults to "Inventario" folder when DRIVE_FOLDER_NAME is not set', async () => {
    mockFilesList.mockResolvedValueOnce({ data: { files: [{ id: 'f1' }] } });
    mockFilesCreate.mockResolvedValueOnce({ data: { id: 'f2' } });

    await uploadFileToDrive({
      buffer: Buffer.from('data'),
      mimeType: 'image/jpeg',
      fileName: 'test.jpg',
    });

    expect(mockFilesList).toHaveBeenCalledWith(
      expect.objectContaining({
        q: expect.stringContaining("name='Inventario'"),
      }),
    );
  });

  it('propagates Drive API errors without swallowing them', async () => {
    mockFilesList.mockResolvedValueOnce({ data: { files: [{ id: 'folder1' }] } });
    mockFilesCreate.mockRejectedValueOnce(new Error('API quota exceeded'));

    await expect(
      uploadFileToDrive({
        buffer: Buffer.from('data'),
        mimeType: 'image/jpeg',
        fileName: 'test.jpg',
      }),
    ).rejects.toThrow('API quota exceeded');
  });

  it('throws when files.create returns no ID', async () => {
    mockFilesList.mockResolvedValueOnce({ data: { files: [{ id: 'folder1' }] } });
    mockFilesCreate.mockResolvedValueOnce({ data: {} }); // no id

    await expect(
      uploadFileToDrive({
        buffer: Buffer.from('data'),
        mimeType: 'image/jpeg',
        fileName: 'test.jpg',
      }),
    ).rejects.toThrow('Drive no devolvió ID del archivo subido.');
  });
});
