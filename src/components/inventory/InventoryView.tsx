'use client';

import { useState, useRef } from 'react';
import { Upload, Download, Plus, ScanLine } from 'lucide-react';
import { useInventory } from '@/hooks/useInventory';
import { useToast } from '@/hooks/useToast';
import { useInventoryFilter } from '@/hooks/useInventoryFilter';
import { exportToCsv } from '@/lib/csv-parser';
import { useCsvImport } from '@/hooks/useCsvImport';
import type { InventoryItem } from '@/lib/types';
import SearchBar from './SearchBar';
import FilterSortSheet from './FilterSortSheet';
import InventoryList from './InventoryList';
import ProductFormModal from './ProductFormModal';
import ProductDetailModal from './ProductDetailModal';
import QrScannerModal from './QrScannerModal';
import CsvPreviewModal from './CsvPreviewModal';
import ScanFab from '@/components/ui/ScanFab';
import styles from './InventoryView.module.css';

type FormTarget = InventoryItem | 'new' | null;

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
  const csvImport = useCsvImport();

  // Controlled mode keeps a local copy; uncontrolled delegates to the hook.
  const [localItems, setLocalItems] = useState<InventoryItem[]>(initialItems ?? []);
  const [isSaving, setIsSaving] = useState(false);
  const products = isControlled ? localItems : localInventory.products;

  const { search, setSearch, selectedCategories, toggleCategory, stockSort, toggleStockSort, filterActive, categories, filtered } =
    useInventoryFilter(products);

  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [formTarget, setFormTarget] = useState<FormTarget>(null);
  const [detailTarget, setDetailTarget] = useState<InventoryItem | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    csvImport.parse(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleCsvConfirm() {
    const items = csvImport.confirm();
    if (isControlled) {
      setLocalItems(items);
    } else {
      localInventory.replaceAll(items);
      toast(`${items.length} productos importados`, 'success');
    }
  }

  function handleCsvExport() {
    const csv = exportToCsv(products);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'inventario.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleSave(item: InventoryItem) {
    if (!isControlled) {
      // Uncontrolled: persist to localStorage only
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

    // Controlled + sheetId: sync to Google Sheets
    setIsSaving(true);
    try {
      if (formTarget === 'new') {
        // Find a sibling item with the same category to determine which sheet tab to use
        const sibling = localItems.find(
          (i) => i.category === item.category && i._sheetMeta,
        );
        if (!sibling?._sheetMeta) {
          toast(`No se encontró un producto con categoría "${item.category}" para determinar la hoja. Elige una categoría existente.`, 'error');
          return;
        }
        const { sheetName, format } = sibling._sheetMeta;

        const res = await fetch('/api/items', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ spreadsheetId: sheetId, sheetName, item, format }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? `Error ${res.status}`);
        }
        const { rowIndex } = await res.json();
        setLocalItems((prev) => [
          ...prev,
          { ...item, _sheetMeta: { sheetName, rowIndex, format } },
        ]);
      } else {
        // Editing: item._sheetMeta was preserved by ProductFormModal
        const meta = item._sheetMeta;
        if (!meta) {
          toast('Este producto no tiene datos de hoja. No se puede actualizar.', 'error');
          return;
        }
        const res = await fetch('/api/items', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            spreadsheetId: sheetId,
            sheetName: meta.sheetName,
            rowIndex: meta.rowIndex,
            item,
            format: meta.format,
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? `Error ${res.status}`);
        }
        setLocalItems((prev) => prev.map((i) => (i.id === item.id ? item : i)));
        if (detailTarget?.id === item.id) setDetailTarget(item);
      }
      setFormTarget(null);
    } catch (err) {
      toast((err as Error).message, 'error');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(item: InventoryItem) {
    if (!isControlled || !sheetId || !item._sheetMeta) {
      // Uncontrolled or no sheet connection: delete from local state only
      if (!isControlled) localInventory.deleteProduct(item.id);
      else setLocalItems((prev) => prev.filter((i) => i.id !== item.id));
      setDetailTarget(null);
      return;
    }

    setIsSaving(true);
    try {
      const { sheetName, rowIndex } = item._sheetMeta;
      const res = await fetch('/api/items', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spreadsheetId: sheetId, sheetName, rowIndex }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Error ${res.status}`);
      }
      setLocalItems((prev) => prev.filter((i) => i.id !== item.id));
      setDetailTarget(null);
    } catch (err) {
      toast((err as Error).message, 'error');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className={styles.root}>
      {/* Toolbar */}
      <div className={styles.toolbar}>
        <button className={styles.toolbarBtn} onClick={() => setScannerOpen(true)}>
          <ScanLine size={15} />
          <span>Escanear</span>
        </button>
        <label className={styles.toolbarBtn}>
          <Upload size={15} />
          <span>Importar</span>
          <input ref={fileInputRef} type="file" accept=".csv" hidden onChange={handleFileSelect} />
        </label>
        <button className={styles.toolbarBtn} onClick={handleCsvExport}>
          <Download size={15} />
          <span>Exportar</span>
        </button>
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

        {/* Filter / sort sheet — rendered here so it positions relative to the search bar */}
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

      {/* List / Empty state */}
      {products.length === 0 && !isControlled ? (
        <div className={styles.emptyState}>
          <p className={styles.emptyTitle}>No hay productos</p>
          <p className={styles.emptySubtitle}>Añade uno manualmente o importa un CSV.</p>
          <div className={styles.emptyActions}>
            <button className={`${styles.toolbarBtn} ${styles.addBtn}`} onClick={() => setFormTarget('new')}>
              <Plus size={15} />
              <span>Agregar producto</span>
            </button>
            <label className={styles.toolbarBtn}>
              <Upload size={15} />
              <span>Importar CSV</span>
              <input ref={fileInputRef} type="file" accept=".csv" hidden onChange={handleFileSelect} />
            </label>
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

      {csvImport.preview !== null && (
        <CsvPreviewModal
          preview={csvImport.preview}
          errors={csvImport.errors}
          onConfirm={handleCsvConfirm}
          onCancel={() => csvImport.reset()}
        />
      )}

      <ScanFab onClick={() => setScannerOpen(true)} />
    </div>
  );
}
