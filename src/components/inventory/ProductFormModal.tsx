'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import type { InventoryItem } from '@/lib/types';
import { validateProduct, type ValidationError } from '@/lib/validation';
import { sanitizeDriveUrl } from '@/lib/url-utils';
import styles from './ProductFormModal.module.css';

interface ProductFormModalProps {
  initialData?: InventoryItem;
  existingCategories: string[];
  onSave: (item: InventoryItem) => void;
  onClose: () => void;
}

const NEW_CAT_SENTINEL = '__new__';

export default function ProductFormModal({
  initialData,
  existingCategories,
  onSave,
  onClose,
}: ProductFormModalProps) {
  const isEdit = !!initialData;

  const [category, setCategory] = useState(initialData?.category ?? existingCategories[0] ?? '');
  const [newCategory, setNewCategory] = useState('');
  const [showNewCat, setShowNewCat] = useState(false);
  const [name, setName] = useState(initialData?.name ?? '');
  const [description, setDescription] = useState(initialData?.description ?? '');
  const [unit, setUnit] = useState(initialData?.unit ?? '');
  const [stock, setStock] = useState(String(initialData?.stock ?? 0));
  const [reorderPoint, setReorderPoint] = useState(String(initialData?.reorderPoint ?? ''));
  const [notes, setNotes] = useState(initialData?.notes ?? '');
  const [imageUrl, setImageUrl] = useState(initialData?.imageUrl ?? '');
  const [techSheetUrl, setTechSheetUrl] = useState(initialData?.techSheetUrl ?? '');
  const [purchasePrice, setPurchasePrice] = useState(String(initialData?.purchasePrice ?? ''));
  const [salePrice, setSalePrice] = useState(String(initialData?.salePrice ?? ''));
  const [videoUrl, setVideoUrl] = useState(initialData?.videoUrl ?? '');
  const [errors, setErrors] = useState<ValidationError[]>([]);

  function fieldError(field: string) {
    return errors.find((e) => e.field === field)?.message;
  }

  function handleCategorySelect(value: string) {
    if (value === NEW_CAT_SENTINEL) {
      setShowNewCat(true);
    } else {
      setShowNewCat(false);
      setCategory(value);
    }
  }

  function handleSave() {
    const resolvedCategory = showNewCat ? newCategory.trim() : category;

    const item: InventoryItem = {
      id: initialData?.id ?? crypto.randomUUID(),
      qrCode: initialData?.qrCode ?? crypto.randomUUID(),
      category: resolvedCategory,

      name: name.trim(),
      description: description.trim(),
      unit: unit.trim(),
      stock: parseFloat(stock) || 0,
      reorderPoint: parseFloat(reorderPoint) || 0,
      imageUrl: imageUrl.trim(),
      purchasePrice: parseFloat(purchasePrice) || 0,
      salePrice: parseFloat(salePrice) || 0,
      notes: notes.trim() || undefined,
      techSheetUrl: techSheetUrl.trim() || undefined,
      videoUrl: videoUrl.trim() || undefined,
    };

    const validationErrors = validateProduct(item);
    if (validationErrors.length) {
      setErrors(validationErrors);
      return;
    }

    setErrors([]);
    onSave(item);
  }

  return (
    <>
      <div className={styles.backdrop} onClick={onClose} aria-hidden="true" />
      <div className={styles.panel} role="dialog" aria-label={isEdit ? 'Editar producto' : 'Agregar producto'}>
        <div className={styles.header}>
          <span className={styles.title}>{isEdit ? 'Editar producto' : 'Agregar producto'}</span>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        <div className={styles.body}>
          {/* Category */}
          <div className={styles.field}>
            <label className={styles.label}>Categoría *</label>
            <select
              className={`${styles.select} ${fieldError('category') ? styles.inputError : ''}`}
              value={showNewCat ? NEW_CAT_SENTINEL : category}
              onChange={(e) => handleCategorySelect(e.target.value)}
            >
              {existingCategories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
              <option value={NEW_CAT_SENTINEL}>Nueva categoría…</option>
            </select>
            {showNewCat && (
              <input
                className={`${styles.input} ${styles.newCategoryInput}`}
                placeholder="Nombre de nueva categoría"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
              />
            )}
            {fieldError('category') && <span className={styles.errorText}>{fieldError('category')}</span>}
          </div>

          {/* Name */}
          <div className={styles.field}>
            <label className={styles.label}>Producto *</label>
            <input className={`${styles.input} ${fieldError('name') ? styles.inputError : ''}`} value={name} onChange={(e) => setName(e.target.value)} />
            {fieldError('name') && <span className={styles.errorText}>{fieldError('name')}</span>}
          </div>

          {/* Description */}
          <div className={styles.field}>
            <label className={styles.label}>Descripción *</label>
            <textarea className={`${styles.textarea} ${fieldError('description') ? styles.inputError : ''}`} value={description} onChange={(e) => setDescription(e.target.value)} />
            {fieldError('description') && <span className={styles.errorText}>{fieldError('description')}</span>}
          </div>

          {/* UOM + Stock row */}
          <div className={styles.field}>
            <label className={styles.label}>UOM *</label>
            <input className={`${styles.input} ${fieldError('unit') ? styles.inputError : ''}`} value={unit} onChange={(e) => setUnit(e.target.value)} />
            {fieldError('unit') && <span className={styles.errorText}>{fieldError('unit')}</span>}
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Stock *</label>
            <input className={`${styles.input} ${fieldError('stock') ? styles.inputError : ''}`} type="number" min="0" value={stock} onChange={(e) => setStock(e.target.value)} />
            {fieldError('stock') && <span className={styles.errorText}>{fieldError('stock')}</span>}
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Punto de reorden *</label>
            <input className={`${styles.input} ${fieldError('reorderPoint') ? styles.inputError : ''}`} type="number" min="0" value={reorderPoint} onChange={(e) => setReorderPoint(e.target.value)} />
            {fieldError('reorderPoint') && <span className={styles.errorText}>{fieldError('reorderPoint')}</span>}
          </div>

          {/* Notes */}
          <div className={styles.field}>
            <label className={styles.label}>Notas</label>
            <textarea className={styles.textarea} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          {/* Foto URL */}
          <div className={styles.field}>
            <label className={styles.label}>Foto (URL) *</label>
            <input
              className={`${styles.input} ${fieldError('imageUrl') ? styles.inputError : ''}`}
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              onBlur={(e) => setImageUrl(sanitizeDriveUrl(e.target.value))}
            />
            {fieldError('imageUrl') && <span className={styles.errorText}>{fieldError('imageUrl')}</span>}
          </div>

          {/* Ficha técnica */}
          <div className={styles.field}>
            <label className={styles.label}>Ficha técnica (URL)</label>
            <input
              className={styles.input}
              value={techSheetUrl}
              onChange={(e) => setTechSheetUrl(e.target.value)}
              onBlur={(e) => setTechSheetUrl(sanitizeDriveUrl(e.target.value))}
            />
          </div>

          {/* Prices */}
          <div className={styles.field}>
            <label className={styles.label}>Precio de compra *</label>
            <input className={`${styles.input} ${fieldError('purchasePrice') ? styles.inputError : ''}`} type="number" min="0" step="0.01" value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} />
            {fieldError('purchasePrice') && <span className={styles.errorText}>{fieldError('purchasePrice')}</span>}
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Precio de venta *</label>
            <input className={`${styles.input} ${fieldError('salePrice') ? styles.inputError : ''}`} type="number" min="0" step="0.01" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} />
            {fieldError('salePrice') && <span className={styles.errorText}>{fieldError('salePrice')}</span>}
          </div>

          {/* Video */}
          <div className={styles.field}>
            <label className={styles.label}>Link de video</label>
            <input className={styles.input} value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} />
          </div>

          {/* QR Code (edit mode only) */}
          {isEdit && (
            <div className={styles.field}>
              <label className={styles.label}>Código QR</label>
              <div className={styles.qrReadonly}>{initialData.qrCode}</div>
            </div>
          )}
        </div>

        <div className={styles.actions}>
          <button className={styles.cancelBtn} onClick={onClose}>Cancelar</button>
          <button className={styles.saveBtn} onClick={handleSave}>
            {isEdit ? 'Guardar cambios' : 'Agregar producto'}
          </button>
        </div>
      </div>
    </>
  );
}
