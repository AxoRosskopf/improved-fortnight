export type StockStatus = 'in-stock' | 'low-stock' | 'out-of-stock';

export interface InventoryItem {
  id: string;
  name: string;
  category: string;

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
}
