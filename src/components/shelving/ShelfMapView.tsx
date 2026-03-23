'use client';

import { useState, useMemo, Fragment } from 'react';
import { X } from 'lucide-react';
import type { InventoryItem } from '@/lib/types';
import styles from './ShelfMapView.module.css';

interface ShelfMapViewProps {
  items: InventoryItem[];
  searchQuery?: string;
}

const SHELVES = 3;
const LEVELS = 4;

// Fixed palette — one colour per category in encounter order
const PALETTE = [
  '#bfdbfe', // blue-200
  '#ddd6fe', // violet-200
  '#fed7aa', // orange-200
  '#bbf7d0', // green-200
  '#fecdd3', // rose-200
  '#fde68a', // yellow-200
];

export default function ShelfMapView({ items, searchQuery = '' }: ShelfMapViewProps) {
  const [selectedCell, setSelectedCell] = useState<string | null>(null);

  // Map each category (that has at least one located item) to a colour
  const categoryColors = useMemo(() => {
    const seen = new Map<string, string>();
    for (const item of items) {
      if (item.category && item.shelf && item.level && !seen.has(item.category)) {
        seen.set(item.category, PALETTE[seen.size % PALETTE.length]);
      }
    }
    return seen;
  }, [items]);

  // Whether any located item is low on stock
  const hasAnyLowStock = useMemo(
    () => items.some(i => i.shelf && i.level && i.stock <= i.reorderPoint),
    [items],
  );

  // Cells to highlight when search query matches an item name/category
  const highlightedCells = useMemo(() => {
    if (!searchQuery.trim()) return new Set<string>();
    const q = searchQuery.toLowerCase();
    const cells = new Set<string>();
    for (const item of items) {
      if (
        item.shelf && item.level &&
        (item.name.toLowerCase().includes(q) || item.category.toLowerCase().includes(q))
      ) {
        cells.add(`E${item.shelf}-N${item.level}`);
      }
    }
    return cells;
  }, [searchQuery, items]);

  // Items in the selected cell — BUG FIX: split gives 2 parts, not 3
  const selectedCellItems = useMemo(() => {
    if (!selectedCell) return [];
    const [shelfPart, levelPart] = selectedCell.split('-');
    const shelf = Number(shelfPart?.slice(1));   // 'E1' → 1
    const level = Number(levelPart?.slice(1));   // 'N2' → 2
    return items.filter(i => i.shelf === shelf && i.level === level);
  }, [selectedCell, items]);

  return (
    <div className={styles.root}>
      <div className={styles.shelvesRow}>
        {Array.from({ length: SHELVES }, (_, si) => {
          const shelfNum = si + 1;
          return (
            <div key={shelfNum} className={styles.shelf}>
              <div className={styles.shelfLabel}>Estante {shelfNum}</div>
              <div className={styles.shelfBody}>
                {Array.from({ length: LEVELS }, (_, li) => {
                  const levelNum = li + 1;
                  const cellId = `E${shelfNum}-N${levelNum}`;
                  const cellItems = items.filter(i => i.shelf === shelfNum && i.level === levelNum);
                  const isSelected = selectedCell === cellId;
                  const isHighlighted = highlightedCells.has(cellId);
                  const hasLowStock = cellItems.some(i => i.stock <= i.reorderPoint);

                  const primaryCategory = cellItems[0]?.category;
                  const cellBg = cellItems.length > 0
                    ? (categoryColors.get(primaryCategory ?? '') ?? PALETTE[0])
                    : undefined;

                  let cellClass = `${styles.cell}${cellItems.length === 0 ? ` ${styles.cell_empty}` : ''}`;
                  if (isSelected) cellClass += ` ${styles.cell_selected}`;
                  if (isHighlighted) cellClass += ` ${styles.cell_highlighted}`;

                  return (
                    <div key={levelNum} className={styles.level}>
                      <span className={styles.levelLabel}>N{levelNum}</span>
                      <div className={styles.cellRow}>
                        <button
                          className={cellClass}
                          style={cellBg ? { background: cellBg } : undefined}
                          onClick={() => setSelectedCell(isSelected ? null : cellId)}
                          title={
                            cellItems.length > 0
                              ? cellItems.map(i => i.name).join(', ')
                              : `${cellId} · Disponible`
                          }
                          aria-label={`${cellId}${cellItems.length > 0 ? `, ${cellItems.length} producto(s)` : ', disponible'}`}
                        >
                          {cellItems.length > 0 && (
                            <span className={styles.cellBadge}>{cellItems.length}</span>
                          )}
                          {hasLowStock && (
                            <span className={styles.cellLowStock} aria-hidden="true" />
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className={styles.shelfBase} />
            </div>
          );
        })}
      </div>

      {/* Legend — one entry per category */}
      <div className={styles.legend}>
        <span className={`${styles.legendDot} ${styles.legendDot_empty}`} />
        <span className={styles.legendLabel}>Disponible</span>
        {[...categoryColors.entries()].map(([cat, color]) => (
          <Fragment key={cat}>
            <span
              className={styles.legendDot}
              style={{ background: color, border: '1px solid rgba(0,0,0,0.12)' }}
            />
            <span className={styles.legendLabel}>{cat}</span>
          </Fragment>
        ))}
        {hasAnyLowStock && (
          <>
            <span className={styles.legendLowStockDot} />
            <span className={styles.legendLabel}>Stock bajo</span>
          </>
        )}
      </div>

      {/* Read-only cell panel */}
      {selectedCell && (
        <div className={styles.panelOverlay} onClick={() => setSelectedCell(null)}>
          <div className={styles.panel} onClick={e => e.stopPropagation()}>
            <div className={styles.panelHeader}>
              <div>
                <span className={styles.panelCellId}>{selectedCell}</span>
                <span className={styles.panelAvailable}>
                  {selectedCellItems.length > 0
                    ? `${selectedCellItems.length} producto(s)`
                    : 'Celda disponible'}
                </span>
              </div>
              <button
                className={styles.panelClose}
                onClick={() => setSelectedCell(null)}
                aria-label="Cerrar"
              >
                <X size={16} />
              </button>
            </div>

            <div className={styles.panelContent}>
              {selectedCellItems.length === 0 ? (
                <p className={styles.panelEmpty}>
                  Sin productos. Asigna esta ubicación al editar un producto.
                </p>
              ) : (
                <div className={styles.itemsList}>
                  {selectedCellItems.map(item => (
                    <div key={item.id} className={styles.itemRow}>
                      <span className={styles.itemRowName}>{item.name}</span>
                      <span className={styles.itemRowStock}>
                        {item.stock} {item.unit}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
