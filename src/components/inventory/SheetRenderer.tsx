import type { SheetData } from '@/lib/google-sheets';
import InventoryView from './InventoryView';

interface Props {
  sheets: SheetData[];
  sheetId: string;
}

export default function SheetRenderer({ sheets, sheetId }: Props) {
  const allItems = sheets.flatMap((s) => s.items);
  return <InventoryView initialItems={allItems} sheetId={sheetId} />;
}
