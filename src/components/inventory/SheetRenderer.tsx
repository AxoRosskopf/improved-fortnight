import type { SheetData } from '@/lib/google-sheets';
import InventoryView from './InventoryView';

interface Props {
  sheets: SheetData[];
}

export default function SheetRenderer({ sheets }: Props) {
  const allItems = sheets.flatMap((s) => s.items);
  return <InventoryView initialItems={allItems} />;
}
