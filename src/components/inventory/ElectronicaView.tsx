'use client';

import { useState } from 'react';
import type { InventoryItem } from '@/lib/types';
import { useInventoryFilter } from '@/hooks/useInventoryFilter';
import SearchBar from './SearchBar';
import InventoryList from './InventoryList';
import ProductDetailModal from './ProductDetailModal';
import styles from './ElectronicaView.module.css';

interface Props {
  sheetName: string;
  items: InventoryItem[];
}

export default function ElectronicaView({ sheetName, items }: Props) {
  const { search, setSearch, filtered } = useInventoryFilter(items);
  const [detailTarget, setDetailTarget] = useState<InventoryItem | null>(null);

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <h2 className={styles.title}>{sheetName}</h2>
        <span className={styles.count}>{filtered.length} producto{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      <SearchBar value={search} onChange={setSearch} />

      {filtered.length === 0 ? (
        <div className={styles.emptyState}>
          <p className={styles.emptyTitle}>Sin resultados</p>
          <p className={styles.emptySubtitle}>Ningún producto coincide con &quot;{search}&quot;</p>
        </div>
      ) : (
        <InventoryList items={filtered} onItemClick={setDetailTarget} />
      )}

      {detailTarget && (
        <ProductDetailModal
          product={detailTarget}
          onEdit={() => setDetailTarget(null)}
          onClose={() => setDetailTarget(null)}
        />
      )}
    </div>
  );
}
