import type { InventoryItem } from '@/lib/types';
import InventoryCard from './InventoryCard';
import styles from './InventoryList.module.css';

interface InventoryListProps {
  items: InventoryItem[];
  onItemClick?: (item: InventoryItem) => void;
}

export default function InventoryList({ items, onItemClick }: InventoryListProps) {
  return (
    <div className={styles.list} aria-label="Inventory items">
      {items.map((item) => (
        <InventoryCard
          key={item.id}
          item={item}
          onClick={onItemClick ? () => onItemClick(item) : undefined}
        />
      ))}
    </div>
  );
}
