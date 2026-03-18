import Image from 'next/image';
import type { InventoryItem, StockStatus } from '@/lib/types';
import styles from './InventoryCard.module.css';

function deriveStatus(product: InventoryItem): StockStatus {
  if (product.stock === 0) return 'out-of-stock';
  if (product.stock <= product.reorderPoint) return 'low-stock';
  return 'in-stock';
}

const statusLabel: Record<StockStatus, string> = {
  'in-stock': 'In Stock',
  'low-stock': 'Low Stock',
  'out-of-stock': 'Out of Stock',
};

export default function InventoryCard({ item, onClick }: { item: InventoryItem; onClick?: () => void }) {
  const status = deriveStatus(item);
  const categoryLabel = item.category;

  return (
    <article
      className={styles.card}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); } : undefined}
    >
      <Image
        src={item.imageUrl || '/images/product-placeholder.svg'}
        alt={item.name}
        width={64}
        height={64}
        className={styles.image}
        unoptimized={!!item.imageUrl}
      />

      <div className={styles.info}>
        <p className={styles.name}>{item.name}</p>
        <p className={styles.category}>{categoryLabel}</p>
        <p className={styles.stock}>
          {item.stock} {item.unit} in Stock
        </p>
        <p className={styles.barcode}>{item.description}</p>
      </div>

      <div className={styles.right}>
        <p className={styles.price}>${item.salePrice?.toFixed(2)}</p>
        <span className={styles.badge} data-status={status}>
          {statusLabel[status]}
        </span>
      </div>
    </article>
  );
}
