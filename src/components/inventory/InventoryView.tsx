'use client';

import { useState, useCallback, useMemo, useRef } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  createColumnHelper,
  type ColumnFiltersState,
  type SortingState,
  type FilterFn,
  type Row,
} from '@tanstack/react-table';
import { X, ArrowUp, ArrowDown, ScanLine, Upload, Download, Plus } from 'lucide-react';
import { useInventory } from '@/hooks/useInventory';
import { useToast } from '@/hooks/useToast';
import { exportToCsv } from '@/lib/csv-parser';
import { useCsvImport } from '@/hooks/useCsvImport';
import type { InventoryItem } from '@/lib/types';
import SearchBar from '@/components/dashboard/SearchBar';
import InventoryList from './InventoryList';
import ProductFormModal from './ProductFormModal';
import ProductDetailModal from './ProductDetailModal';
import QrScannerModal from './QrScannerModal';
import CsvPreviewModal from './CsvPreviewModal';
import ScanFab from '@/components/ui/ScanFab';
import styles from './InventoryView.module.css';

// ---------------------------------------------------------------------------
// Column helper & filter functions
// ---------------------------------------------------------------------------

const columnHelper = createColumnHelper<InventoryItem>();

const globalFilterFn: FilterFn<InventoryItem> = (row: Row<InventoryItem>, _: string, filterValue: string) => {
  const s = filterValue.toLowerCase();
  return (
    row.original.name?.toLowerCase().includes(s) ||
    row.original.description?.toLowerCase().includes(s) ||
    row.original.qrCode?.toLowerCase().includes(s)
  );
};
globalFilterFn.autoRemove = (val: unknown) => !val;

const categoryFilterFn: FilterFn<InventoryItem> = (row: Row<InventoryItem>, columnId: string, filterValue: string[]) => {
  if (!filterValue.length) return true;
  return filterValue.includes(row.getValue(columnId));
};
categoryFilterFn.autoRemove = (val: unknown) => !Array.isArray(val) || val.length === 0;

const columns = [
  columnHelper.accessor('name', { enableGlobalFilter: true, enableSorting: false }),
  columnHelper.accessor('description', { enableGlobalFilter: true, enableSorting: false }),
  columnHelper.accessor('qrCode', { enableGlobalFilter: true, enableSorting: false }),
  columnHelper.accessor('category', { enableGlobalFilter: false, filterFn: categoryFilterFn, enableSorting: false }),
  columnHelper.accessor('stock', { enableGlobalFilter: false, enableColumnFilter: false }),
];

// ---------------------------------------------------------------------------
// InventoryView
// ---------------------------------------------------------------------------

type FormTarget = InventoryItem | 'new' | null;

export default function InventoryView() {
  const { products, addProduct, updateProduct, replaceAll } = useInventory();
  const { toast } = useToast();
  const csvImport = useCsvImport();

  // Table state
  const [globalFilter, setGlobalFilter] = useState('');
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Modal state
  const [formTarget, setFormTarget] = useState<FormTarget>(null);
  const [detailTarget, setDetailTarget] = useState<InventoryItem | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const table = useReactTable({
    data: products,
    columns,
    state: { globalFilter, columnFilters, sorting },
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
    onSortingChange: setSorting,
    globalFilterFn,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const filteredItems = table.getRowModel().rows.map((r) => r.original);

  const categories = useMemo(
    () => [...new Set(products.map((p) => p.category))].sort(),
    [products],
  );

  const selectedCategories = (columnFilters.find((f) => f.id === 'category')?.value as string[]) ?? [];
  const stockSort = sorting.find((s) => s.id === 'stock');
  const filterActive = selectedCategories.length > 0 || !!stockSort;

  const toggleCategory = useCallback((cat: string) => {
    setColumnFilters((prev) => {
      const current = (prev.find((f) => f.id === 'category')?.value as string[]) ?? [];
      const next = current.includes(cat) ? current.filter((c) => c !== cat) : [...current, cat];
      const others = prev.filter((f) => f.id !== 'category');
      return next.length ? [...others, { id: 'category', value: next }] : others;
    });
  }, []);

  const toggleStockSort = useCallback(() => {
    setSorting((prev) => {
      const current = prev.find((s) => s.id === 'stock');
      if (!current) return [{ id: 'stock', desc: false }];
      if (!current.desc) return [{ id: 'stock', desc: true }];
      return [];
    });
  }, []);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    csvImport.parse(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleCsvConfirm() {
    const items = csvImport.confirm();
    replaceAll(items);
    toast(`${items.length} productos importados`, 'success');
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

  function handleSave(item: InventoryItem) {
    if (formTarget === 'new') {
      addProduct(item);
    } else if (formTarget) {
      updateProduct(item.id, item);
      // sync detailTarget if it was open
      if (detailTarget?.id === item.id) setDetailTarget(item);
    }
    setFormTarget(null);
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
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            hidden
            onChange={handleFileSelect}
          />
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
      <SearchBar
        value={globalFilter}
        onChange={setGlobalFilter}
        onFilterClick={() => setIsFilterOpen(true)}
        filterActive={filterActive}
      />

      {/* List / Empty state */}
      {products.length === 0 ? (
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
      ) : filteredItems.length === 0 ? (
        <div className={styles.emptyState}>
          <p className={styles.emptySubtitle}>No se encontraron productos con ese filtro.</p>
        </div>
      ) : (
        <InventoryList items={filteredItems} onItemClick={(item) => setDetailTarget(item)} />
      )}

      {/* Filter / sort overlay */}
      {isFilterOpen && (
        <>
          <div className={styles.overlay} aria-hidden="true" onClick={() => setIsFilterOpen(false)} />
          <div className={styles.sheet} role="dialog" aria-label="Filtrar y ordenar">
            <div className={styles.sheetHeader}>
              <span className={styles.sheetTitle}>Filtrar y ordenar</span>
              <button className={styles.closeBtn} aria-label="Cerrar" onClick={() => setIsFilterOpen(false)}>
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
                    onClick={() => toggleCategory(cat)}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.section}>
              <p className={styles.sectionLabel}>Ordenar por Stock</p>
              <button className={styles.sortRow} onClick={toggleStockSort}>
                <span>
                  {!stockSort && 'Orden predeterminado'}
                  {stockSort && !stockSort.desc && 'Menor → Mayor'}
                  {stockSort?.desc && 'Mayor → Menor'}
                </span>
                {stockSort && !stockSort.desc && <ArrowUp size={16} />}
                {stockSort?.desc && <ArrowDown size={16} />}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Modals */}
      {formTarget !== null && (
        <ProductFormModal
          initialData={formTarget === 'new' ? undefined : formTarget}
          existingCategories={categories.length ? categories : ['Automotriz', 'Tapicería', 'Electrónica']}
          onSave={handleSave}
          onClose={() => setFormTarget(null)}
        />
      )}

      {detailTarget && (
        <ProductDetailModal
          product={detailTarget}
          onEdit={() => {
            setFormTarget(detailTarget);
            setDetailTarget(null);
          }}
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
