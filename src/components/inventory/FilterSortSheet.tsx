import { X, ArrowUp, ArrowDown } from 'lucide-react';
import type { StockSortDir } from '@/hooks/useInventoryFilter';
import styles from './InventoryView.module.css';

interface FilterSortSheetProps {
  categories: string[];
  selectedCategories: string[];
  stockSort: StockSortDir;
  onToggleCategory: (cat: string) => void;
  onToggleStockSort: () => void;
  onClose: () => void;
}

export default function FilterSortSheet({
  categories,
  selectedCategories,
  stockSort,
  onToggleCategory,
  onToggleStockSort,
  onClose,
}: FilterSortSheetProps) {
  return (
    <>
      <div className={styles.overlay} aria-hidden="true" onClick={onClose} />
      <div className={styles.sheet} role="dialog" aria-label="Filtrar y ordenar">
        <div className={styles.sheetHeader}>
          <span className={styles.sheetTitle}>Filtrar y ordenar</span>
          <button className={styles.closeBtn} aria-label="Cerrar" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className={styles.section}>
          <p className={styles.sectionLabel}>Categoría</p>
          <div className={styles.chips}>
            {categories.map((cat) => (
              <button
                key={cat}
                className={styles.chip}
                data-selected={selectedCategories.includes(cat)}
                onClick={() => onToggleCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.section}>
          <p className={styles.sectionLabel}>Ordenar por Stock</p>
          <button className={styles.sortRow} onClick={onToggleStockSort}>
            <span>
              {stockSort === null && 'Orden predeterminado'}
              {stockSort === 'asc' && 'Menor → Mayor'}
              {stockSort === 'desc' && 'Mayor → Menor'}
            </span>
            {stockSort === 'asc' && <ArrowUp size={16} />}
            {stockSort === 'desc' && <ArrowDown size={16} />}
          </button>
        </div>
      </div>
    </>
  );
}
