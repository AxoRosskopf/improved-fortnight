import Papa from 'papaparse';
import { InventoryItem } from './types';
import { sanitizeDriveUrl } from './url-utils';

export type CsvFormat = 'case-a' | 'case-b' | 'unknown';

export interface ParseResult {
  products: InventoryItem[];
  errors: Array<{ row: number; message: string }>;
}

// ---------------------------------------------------------------------------
// Unified mapping primitives
// ---------------------------------------------------------------------------

interface ColumnMap {
  csvColumn: string;
  apply: (raw: string, product: Partial<InventoryItem>) => void;
}

interface FormatConfig {
  detectKey: string;
  category?: InventoryItem['category'];
  columns: ColumnMap[];
}

// ---------------------------------------------------------------------------
// Transform helpers
// ---------------------------------------------------------------------------

function parsePrice(raw: string): number | undefined {
  const cleaned = raw.replace(/[$,\s]/g, '');
  const n = parseFloat(cleaned);
  return isNaN(n) ? undefined : n;
}

function parseQuantity(raw: string): { stock: number; unit?: string } {
  const match = raw.trim().match(/^([\d.,]+)\s*(.*)/);
  if (!match) return { stock: 0 };
  const stock = parseFloat(match[1].replace(/,/g, ''));
  const unit = match[2].trim() || undefined;
  return { stock: isNaN(stock) ? 0 : stock, unit };
}

// ---------------------------------------------------------------------------
// Pre-built configs
// ---------------------------------------------------------------------------

const CASE_A_CONFIG: FormatConfig = {
  detectKey: 'Nombre',
  category: 'Electrónica',
  columns: [
    {
      csvColumn: 'Nombre',
      apply: (raw, p) => { p.name = raw.trim(); },
    },
    {
      csvColumn: 'Cantidad',
      apply: (raw, p) => {
        const { stock, unit } = parseQuantity(raw);
        p.stock = stock;
        if (unit) p.unit = unit;
      },
    },
    {
      csvColumn: 'Precio de compra',
      apply: (raw, p) => { p.purchasePrice = parsePrice(raw); },
    },
    {
      csvColumn: 'Precio de venta',
      apply: (raw, p) => { p.salePrice = parsePrice(raw); },
    },
    {
      csvColumn: 'Foto',
      apply: (raw, p) => { p.imageUrl = sanitizeDriveUrl(raw) || undefined; },
    },
    {
      csvColumn: 'Ficha tecnica', // Corregido: Sin tilde según el CSV
      apply: (raw, p) => { p.techSheetUrl = sanitizeDriveUrl(raw) || undefined; },
    },
  ],
};

const CASE_B_CONFIG: FormatConfig = {
  detectKey: 'Producto',
  columns: [
    {
      csvColumn: 'Producto',
      apply: (raw, p) => { p.name = raw.trim(); },
    },
    {
      csvColumn: 'Categoría', // Asigna la categoría si viene en el CSV
      apply: (raw, p) => { if (raw.trim()) p.category = raw.trim() as any; }
    },
    {
      csvColumn: 'UOM',
      apply: (raw, p) => { p.unit = raw.trim() || undefined; },
    },
    {
      csvColumn: 'Aplicaciones/Especificación',
      apply: (raw, p) => { p.description = raw.trim() || undefined; },
    },
    {
      csvColumn: 'Stock inicial sugerido',
      apply: (raw, p) => { p.stock = parseFloat(raw.replace(/,/g, '')) || 0; },
    },
    {
      csvColumn: 'Punto de reorden',
      apply: (raw, p) => {
        const val = parseFloat(raw.replace(/,/g, ''));
        if (!isNaN(val)) (p as any).reorderPoint = val; 
      },
    },
    {
      csvColumn: 'Notas',
      apply: (raw, p) => { (p as any).notes = raw.trim() || undefined; },
    },
    {
      csvColumn: 'Foto',
      apply: (raw, p) => { p.imageUrl = sanitizeDriveUrl(raw) || undefined; },
    },
    {
      csvColumn: 'Ficha tecnica', // Corregido: Sin tilde según el CSV
      apply: (raw, p) => { p.techSheetUrl = sanitizeDriveUrl(raw) || undefined; },
    },
    {
      csvColumn: 'Link de video',
      apply: (raw, p) => { p.videoUrl = raw.trim() || undefined; },
    },
    {
      csvColumn: 'Precio de compra', // Agregado para Auto/Tapicería
      apply: (raw, p) => { p.purchasePrice = parsePrice(raw); },
    },
    {
      csvColumn: 'Precio de venta', // Agregado para Auto/Tapicería
      apply: (raw, p) => { p.salePrice = parsePrice(raw); },
    },
  ],
};

const CONFIGS: FormatConfig[] = [CASE_A_CONFIG, CASE_B_CONFIG];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function detectFormat(headers: string[]): CsvFormat {
  const normalized = headers.map((h) => h.trim());
  if (normalized.includes('Nombre')) return 'case-a';
  if (normalized.includes('Producto')) return 'case-b';
  return 'unknown';
}

const EXPORT_COLUMNS = [
  'Categoría', 'Producto', 'Aplicaciones/Especificación',
  'UOM', 'Stock', 'Punto de reorden', 'Notas', 'Foto', 'Ficha técnica',
  'Precio compra', 'Precio venta', 'Link video', 'QR Code',
] as const;

export function exportToCsv(products: InventoryItem[]): string {
  const rows = products.map((p) => ({
    'Categoría': p.category,
    'Producto': p.name,
    'Aplicaciones/Especificación': p.description ?? '',
    'UOM': p.unit ?? '',
    'Stock': p.stock,
    'Punto de reorden': (p as any).reorderPoint ?? '',
    'Notas': (p as any).notes ?? '',
    'Foto': p.imageUrl ?? '',
    'Ficha técnica': p.techSheetUrl ?? '',
    'Precio compra': p.purchasePrice ?? '',
    'Precio venta': p.salePrice ?? '',
    'Link video': p.videoUrl ?? '',
    'QR Code': (p as any).qrCode ?? '',
  }));
  return Papa.unparse(rows, { columns: EXPORT_COLUMNS as unknown as string[] });
}

export function parseRows(
  rows: Record<string, string>[],
  category?: 'Automotriz' | 'Tapicería',
): ParseResult {
  if (rows.length === 0) return { products: [], errors: [] };

  const headers = Object.keys(rows[0]);
  const format = detectFormat(headers);

  if (format === 'unknown') {
    return {
      products: [],
      errors: [{ row: 0, message: 'Formato de CSV no reconocido (cabeceras desconocidas).' }],
    };
  }

  const config = CONFIGS.find((c) => c.detectKey === (format === 'case-a' ? 'Nombre' : 'Producto'))!;
  
  const products: InventoryItem[] = [];
  const errors: Array<{ row: number; message: string }> = [];

  rows.forEach((row, idx) => {
    const rowNumber = idx + 2; 
    
    // Asignación de categoría base
    const product: Partial<InventoryItem> = {
      id: crypto.randomUUID(),
      stock: 0,
      category: config.category ?? (category as InventoryItem['category']),
    };

    for (const map of config.columns) {
      const raw = row[map.csvColumn] ?? '';
      map.apply(raw, product);
    }

    if (!product.name) {
      errors.push({ row: rowNumber, message: `Fila ${rowNumber}: el campo "nombre" o "producto" está vacío.` });
      return;
    }

    products.push(product as InventoryItem);
  });

  return { products, errors };
}