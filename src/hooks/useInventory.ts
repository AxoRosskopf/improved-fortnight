'use client';

import { useState, useEffect, useCallback } from 'react';
import { InventoryItems } from '@/lib/mock-data';
import { validateProduct } from '@/lib/validation';
import type { InventoryItem } from '@/lib/types';

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

const STORAGE_KEY = 'inventoryItems';

function loadFromStorage(): InventoryItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as InventoryItem[];
  } catch {
    // ignore parse errors
  }
  return InventoryItems;
}

export interface UseInventory {
  products: InventoryItem[];
  addProduct: (data: Omit<InventoryItem, 'id' | 'qrCode'>) => InventoryItem;
  updateProduct: (id: string, patch: Partial<InventoryItem>) => void;
  deleteProduct: (id: string) => void;
  replaceAll: (items: InventoryItem[]) => void;
  findByQrCode: (code: string) => InventoryItem | undefined;
}

export function useInventory(): UseInventory {
  const [products, setProducts] = useState<InventoryItem[]>(InventoryItems);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from localStorage after mount to avoid SSR mismatch
  useEffect(() => {
    const stored = loadFromStorage();
    setProducts(stored);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
    } catch {
      // ignore storage errors (e.g. private browsing quota)
    }
  }, [products, hydrated]);

  const addProduct = useCallback((data: Omit<InventoryItem, 'id' | 'qrCode'>): InventoryItem => {
    const errors = validateProduct(data);
    if (errors.length) {
      throw new Error(errors.map((e) => e.message).join(', '));
    }
    const id = crypto.randomUUID();
    const qrCode = `${slugify(data.name)}-${id.slice(0, 8)}`;
    const item: InventoryItem = { ...data, id, qrCode };
    setProducts((prev) => [...prev, item]);
    return item;
  }, []);

  const updateProduct = useCallback((id: string, patch: Partial<InventoryItem>) => {
    setProducts((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        const merged = { ...p, ...patch };
        const errors = validateProduct(merged);
        if (errors.length) {
          throw new Error(errors.map((e) => e.message).join(', '));
        }
        return merged;
      }),
    );
  }, []);

  const deleteProduct = useCallback((id: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const replaceAll = useCallback((items: InventoryItem[]) => {
    setProducts(items);
  }, []);

  const findByQrCode = useCallback(
    (code: string) => products.find((p) => p.qrCode === code),
    [products],
  );

  return { products, addProduct, updateProduct, deleteProduct, replaceAll, findByQrCode };
}
