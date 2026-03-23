import { NextRequest, NextResponse } from 'next/server';
import { put, del } from '@vercel/blob';
import { buildFileName } from '@/lib/google-drive-upload';

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

export async function POST(request: NextRequest) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Cuerpo inválido.' }, { status: 400 });
  }

  const file = formData.get('file');
  const category = String(formData.get('category') ?? '');
  const name = String(formData.get('name') ?? '');

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Falta el archivo.' }, { status: 400 });
  }
  if (!file.type.startsWith('image/')) {
    return NextResponse.json(
      { error: 'El archivo debe ser una imagen (jpeg, png, webp, etc.).' },
      { status: 400 },
    );
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: 'La imagen no puede superar 10 MB.' },
      { status: 400 },
    );
  }

  try {
    const fileName = buildFileName(category, name, file.name);
    const { url } = await put(fileName, file, {
      access: 'public',
      contentType: file.type,
    });
    return NextResponse.json({ driveUrl: url, fileName });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error desconocido';
    return NextResponse.json(
      { error: `Error al subir la imagen: ${message}` },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  let url: string;
  try {
    const body = await request.json() as { url?: unknown };
    url = String(body.url ?? '');
  } catch {
    return NextResponse.json({ error: 'Cuerpo inválido.' }, { status: 400 });
  }

  if (!url.includes('blob.vercel-storage.com')) {
    return NextResponse.json({ error: 'URL no válida.' }, { status: 400 });
  }

  try {
    await del(url);
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error desconocido';
    return NextResponse.json(
      { error: `Error al eliminar la imagen: ${message}` },
      { status: 500 },
    );
  }
}
