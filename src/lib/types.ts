export type StockStatus = 'in-stock' | 'low-stock' | 'out-of-stock';

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

  /** Present only when the item was fetched from Google Sheets. */
  _sheetMeta?: SheetMeta;
}
