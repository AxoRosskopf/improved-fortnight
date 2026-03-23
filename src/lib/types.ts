export type StockStatus = 'in-stock' | 'low-stock' | 'out-of-stock';

export interface LogEntry {
  timestamp: string;          // ISO string
  userName: string;
  action: 'Creó' | 'Editó' | 'Eliminó';
  itemName: string;
  sheetName: string;
}

/** Internal metadata attached when an item is loaded from Google Sheets.
 *  Never displayed in the UI or exported to CSV. */
export interface SheetMeta {
  sheetName: string;   // Tab name, e.g. "Automotriz"
  rowIndex: number;    // 1-based absolute row number in that tab
  format: 'case-a' | 'case-b';
}

export interface InventoryItem {
  id: string;
  name: string;
  category: string;
  subcategory?: string;

  description: string;
  unit: string;
  stock: number;
  purchasePrice: number;
  salePrice: number;
  imageUrl: string;
  reorderPoint: number;
  qrCode: string;
  techSheetUrl?: string;
  videoUrl?: string;
  notes?: string;

  /** Shelf map location — stored as columns "Estante" / "Nivel" in Google Sheets. */
  shelf?: number;  // 1–3
  level?: number;  // 1–4

  /** Present only when the item was fetched from Google Sheets. */
  _sheetMeta?: SheetMeta;
}
