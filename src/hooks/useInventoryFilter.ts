import { useState, useMemo } from 'react';
import type { InventoryItem } from '@/lib/types';

export type StockSortDir = 'asc' | 'desc' | null;

export interface InventoryFilterState {
  search: string;
  setSearch: (v: string) => void;
  selectedCategories: string[];
  toggleCategory: (cat: string) => void;
  stockSort: StockSortDir;
  toggleStockSort: () => void;
  filterActive: boolean;
  categories: string[];
  filtered: InventoryItem[];
}

export function useInventoryFilter(items: InventoryItem[]): InventoryFilterState {
  const [search, setSearch] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [stockSort, setStockSort] = useState<StockSortDir>(null);

  const categories = useMemo(
    () => [...new Set(items.map((i) => i.category).filter(Boolean))].sort(),
    [items],
  );

  const filtered = useMemo(() => {
    let result = items;

    if (search) {
      const s = search.toLowerCase();
      result = result.filter(
        (i) =>
          i.name?.toLowerCase().includes(s) ||
          i.description?.toLowerCase().includes(s) ||
          i.qrCode?.toLowerCase().includes(s),
      );
    }

    if (selectedCategories.length) {
      result = result.filter((i) => selectedCategories.includes(i.category));
    }

    if (stockSort) {
      result = [...result].sort((a, b) =>
        stockSort === 'desc' ? b.stock - a.stock : a.stock - b.stock,
      );
    }

    return result;
  }, [items, search, selectedCategories, stockSort]);

  function toggleCategory(cat: string) {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat],
    );
  }

  function toggleStockSort() {
    setStockSort((prev) => {
      if (prev === null) return 'asc';
      if (prev === 'asc') return 'desc';
      return null;
    });
  }

  const filterActive = selectedCategories.length > 0 || stockSort !== null;

  return {
    search,
    setSearch,
    selectedCategories,
    toggleCategory,
    stockSort,
    toggleStockSort,
    filterActive,
    categories,
    filtered,
  };
}
