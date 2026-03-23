'use client';

import { useState, useEffect } from 'react';
import { Plus, ScanLine, ClipboardList, LayoutList, Map } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useInventory } from '@/hooks/useInventory';
import { useToast } from '@/hooks/useToast';
import { useInventoryFilter } from '@/hooks/useInventoryFilter';
import { useSheetsSync } from '@/hooks/useSheetsSync';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import type { InventoryItem } from '@/lib/types';
import SearchBar from './SearchBar';
import FilterSortSheet from './FilterSortSheet';
import InventoryList from './InventoryList';
import ProductFormModal from './ProductFormModal';
import ProductDetailModal from './ProductDetailModal';
import QrScannerModal from './QrScannerModal';
import ScanFab from '@/components/ui/ScanFab';
import ShelfMapView from '@/components/shelving/ShelfMapView';
import styles from './InventoryView.module.css';

type FormTarget = InventoryItem | 'new' | null;
type ViewMode = 'list' | 'map';

interface InventoryViewProps {
  /** Items loaded from Google Sheets. When provided, mutations sync back to the sheet. */
  initialItems?: InventoryItem[];
  /** Google Spreadsheet ID — required to write back to the sheet. */
  sheetId?: string;
}

export default function InventoryView({ initialItems, sheetId }: InventoryViewProps) {
  const isControlled = initialItems !== undefined;

  // Always call hooks unconditionally (React rules).
  const localInventory = useInventory();
  const { toast } = useToast();
  const { userName, isLoaded } = useCurrentUser();
  const router = useRouter();

  // Gate: redirect to /register if not registered (controlled mode only)
  useEffect(() => {
    if (isControlled && sheetId && isLoaded && !userName) {
      router.push(`/register?from=/dashboard/${sheetId}`);
    }
  }, [isLoaded, userName, isControlled, sheetId, router]);

  // Controlled mode keeps a local copy; uncontrolled delegates to the hook.
  const [localItems, setLocalItems] = useState<InventoryItem[]>(initialItems ?? []);

  // Sync from server whenever initialItems changes (after router.refresh()).
  useEffect(() => {
    if (initialItems !== undefined) setLocalItems(initialItems);
  }, [initialItems]);
  const products = isControlled ? localItems : localInventory.products;

  const sheetsSync = useSheetsSync(sheetId ?? '', setLocalItems);
  const isSaving = sheetsSync.isSaving;

  const { search, setSearch, selectedCategories, toggleCategory, stockSort, toggleStockSort, filterActive, categories, filtered } =
    useInventoryFilter(products);

  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [formTarget, setFormTarget] = useState<FormTarget>(null);
  const [detailTarget, setDetailTarget] = useState<InventoryItem | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);

  async function handleSave(item: InventoryItem) {
    if (!isControlled) {
      if (formTarget === 'new') {
        localInventory.addProduct(item);
      } else if (formTarget) {
        localInventory.updateProduct(item.id, item);
        if (detailTarget?.id === item.id) setDetailTarget(item);
      }
      setFormTarget(null);
      return;
    }

    if (!sheetId) {
      // Controlled but no sheetId: update local state only
      if (formTarget === 'new') {
        setLocalItems((prev) => [...prev, item]);
      } else {
        setLocalItems((prev) => prev.map((i) => (i.id === item.id ? item : i)));
        if (detailTarget?.id === item.id) setDetailTarget(item);
      }
      setFormTarget(null);
      return;
    }

    const isNew = formTarget === 'new';
    const success = await sheetsSync.save(item, isNew, localItems);
    if (success) {
      if (!isNew && detailTarget?.id === item.id) setDetailTarget(item);
      setFormTarget(null);
      router.refresh();
    }
  }

  function deleteBlobImage(imageUrl: string) {
    if (!imageUrl.includes('blob.vercel-storage.com')) return;
    void fetch('/api/drive-upload', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: imageUrl }),
    });
  }

  async function handleDelete(item: InventoryItem) {
    if (item.imageUrl) deleteBlobImage(item.imageUrl);

    if (!isControlled || !sheetId || !item._sheetMeta) {
      if (!isControlled) localInventory.deleteProduct(item.id);
      else setLocalItems((prev) => prev.filter((i) => i.id !== item.id));
      setDetailTarget(null);
      return;
    }

    await sheetsSync.remove(item);
    setDetailTarget(null);
    router.refresh();
  }

  return (
    <div className={styles.root}>
      {/* Toolbar */}
      <div className={styles.toolbar}>
        <button className={styles.toolbarBtn} onClick={() => setScannerOpen(true)}>
          <ScanLine size={15} />
          <span>Escanear</span>
        </button>
        {isControlled && sheetId && (
          <Link href={`/dashboard/${sheetId}/logs`} className={styles.toolbarBtn}>
            <ClipboardList size={15} />
            <span>Actividad</span>
          </Link>
        )}
        <div className={styles.viewToggle}>
          <button
            className={`${styles.viewToggleBtn} ${viewMode === 'list' ? styles.viewToggleActive : ''}`}
            onClick={() => setViewMode('list')}
            aria-label="Vista lista"
          >
            <LayoutList size={15} />
          </button>
          <button
            className={`${styles.viewToggleBtn} ${viewMode === 'map' ? styles.viewToggleActive : ''}`}
            onClick={() => setViewMode('map')}
            aria-label="Mapa de repisas"
          >
            <Map size={15} />
          </button>
        </div>
        <button className={`${styles.toolbarBtn} ${styles.addBtn}`} onClick={() => setFormTarget('new')}>
          <Plus size={15} />
          <span>Agregar</span>
        </button>
      </div>

      {/* Search + filter */}
      <div className={styles.searchWrapper}>
        <SearchBar
          value={search}
          onChange={setSearch}
          onFilterClick={() => setIsFilterOpen(true)}
          filterActive={filterActive}
        />

        {isFilterOpen && (
          <FilterSortSheet
            categories={categories}
            selectedCategories={selectedCategories}
            stockSort={stockSort}
            onToggleCategory={toggleCategory}
            onToggleStockSort={toggleStockSort}
            onClose={() => setIsFilterOpen(false)}
          />
        )}
      </div>

      {/* List / Map / Empty state */}
      {viewMode === 'map' ? (
        <ShelfMapView items={products} searchQuery={search} />
      ) : products.length === 0 && !isControlled ? (
        <div className={styles.emptyState}>
          <p className={styles.emptyTitle}>No hay productos</p>
          <p className={styles.emptySubtitle}>Añade un producto manualmente.</p>
          <div className={styles.emptyActions}>
            <button className={`${styles.toolbarBtn} ${styles.addBtn}`} onClick={() => setFormTarget('new')}>
              <Plus size={15} />
              <span>Agregar producto</span>
            </button>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className={styles.emptyState}>
          <p className={styles.emptySubtitle}>No se encontraron productos con ese filtro.</p>
        </div>
      ) : (
        <InventoryList items={filtered} onItemClick={(item) => setDetailTarget(item)} />
      )}

      {/* Modals */}
      {formTarget !== null && (
        <ProductFormModal
          initialData={formTarget === 'new' ? undefined : formTarget}
          existingCategories={categories.length ? categories : ['Automotriz', 'Tapicería', 'Electrónica']}
          onSave={handleSave}
          onClose={() => setFormTarget(null)}
          saving={isSaving}
        />
      )}

      {detailTarget && (
        <ProductDetailModal
          product={detailTarget}
          onEdit={() => {
            setFormTarget(detailTarget);
            setDetailTarget(null);
          }}
          onDelete={isControlled ? () => handleDelete(detailTarget) : undefined}
          onClose={() => setDetailTarget(null)}
        />
      )}

      {scannerOpen && (
        <QrScannerModal
          products={products}
          onFound={(p) => {
            setScannerOpen(false);
            setDetailTarget(p);
          }}
          onNotFound={(code) => {
            setScannerOpen(false);
            toast(`Producto no encontrado: ${code}`, 'error');
          }}
          onClose={() => setScannerOpen(false)}
        />
      )}

      <ScanFab onClick={() => setScannerOpen(true)} />
    </div>
  );
}
