'use client';

import { useState, useRef } from 'react';
import { X, Upload, ImageIcon, Camera } from 'lucide-react';
import type { InventoryItem } from '@/lib/types';
import { validateProduct, type ValidationError } from '@/lib/validation';
import { driveProxyUrl } from '@/lib/url-utils';
import styles from './ProductFormModal.module.css';

interface ProductFormModalProps {
  initialData?: InventoryItem;
  existingCategories: string[];
  onSave: (item: InventoryItem) => void;
  onClose: () => void;
  saving?: boolean;
}

type UploadState = 'idle' | 'uploading' | 'done' | 'error';

const NEW_CAT_SENTINEL = '__new__';

export default function ProductFormModal({
  initialData,
  existingCategories,
  onSave,
  onClose,
  saving = false,
}: ProductFormModalProps) {
  const isEdit = !!initialData;

  // Form fields
  const [category, setCategory] = useState(initialData?.category ?? existingCategories[0] ?? '');
  const [newCategory, setNewCategory] = useState('');
  const [showNewCat, setShowNewCat] = useState(false);
  const [subcategory, setSubcategory] = useState(initialData?.subcategory ?? '');
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

  // Location in shelf map (persisted as columns in Google Sheets)
  const [locShelf, setLocShelf] = useState<number | ''>(initialData?.shelf ?? '');
  const [locLevel, setLocLevel] = useState<number | ''>(initialData?.level ?? '');

  // Upload state
  const [uploadState, setUploadState] = useState<UploadState>(
    isEdit && initialData?.imageUrl ? 'done' : 'idle',
  );
  const [uploadError, setUploadError] = useState('');
  const [previewSrc, setPreviewSrc] = useState<string | null>(
    isEdit && initialData?.imageUrl ? driveProxyUrl(initialData.imageUrl) : null,
  );
  const [replacing, setReplacing] = useState(false);
  const [dragging, setDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const prevObjectUrl = useRef<string | null>(null);

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

  async function handleFileSelect(file: File) {
    // Revoke previous object URL to avoid memory leaks
    if (prevObjectUrl.current) {
      URL.revokeObjectURL(prevObjectUrl.current);
    }
    const objectUrl = URL.createObjectURL(file);
    prevObjectUrl.current = objectUrl;

    setPreviewSrc(objectUrl);
    setUploadState('uploading');
    setUploadError('');

    const resolvedCategory = showNewCat ? newCategory.trim() : category;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('category', resolvedCategory || 'sin-categoria');
    formData.append('name', name.trim() || 'sin-nombre');

    try {
      const res = await fetch('/api/drive-upload', { method: 'POST', body: formData });
      const json = await res.json() as { driveUrl?: string; error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Error desconocido');
      setImageUrl(json.driveUrl ?? '');
      setUploadState('done');
    } catch (err) {
      setUploadState('error');
      setUploadError(err instanceof Error ? err.message : 'Error al subir la imagen');
      setPreviewSrc(null);
    }
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void handleFileSelect(file);
    // Reset input so the same file can be re-selected after an error
    e.target.value = '';
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragging(true);
  }

  function onDragLeave() {
    setDragging(false);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) void handleFileSelect(file);
  }

  function handleRetry() {
    setUploadState('idle');
    setPreviewSrc(null);
    setUploadError('');
    setImageUrl('');
  }

  function handleReplaceClick() {
    setReplacing(true);
    setUploadState('idle');
    setPreviewSrc(null);
    setImageUrl('');
    setUploadError('');
  }

  function handleSave() {
    const resolvedCategory = showNewCat ? newCategory.trim() : category;

    const item: InventoryItem = {
      id: initialData?.id ?? crypto.randomUUID(),
      qrCode: initialData?.qrCode ?? crypto.randomUUID(),
      category: resolvedCategory,
      subcategory: subcategory.trim() || undefined,
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
      shelf: locShelf !== '' ? locShelf : undefined,
      level: locLevel !== '' ? locLevel : undefined,
      _sheetMeta: initialData?._sheetMeta,
    };

    const validationErrors = validateProduct(item);
    if (validationErrors.length) {
      setErrors(validationErrors);
      return;
    }

    setErrors([]);
    onSave(item);
  }

  // Show the upload zone for new items, or for edit items when replacing
  const showUploadZone = !isEdit || replacing;

  // Disable save if:
  //  - parent is saving
  //  - new item and no upload yet
  //  - replacement upload in progress
  const saveDisabled =
    saving ||
    (!isEdit && uploadState !== 'done') ||
    (replacing && uploadState === 'uploading');

  // Build upload zone CSS class
  function uploadZoneClass() {
    const base = styles.uploadZone;
    if (uploadState === 'uploading') return `${base} ${styles.uploadZoneUploading}`;
    if (uploadState === 'error') return `${base} ${styles.uploadZoneError}`;
    if (uploadState === 'done') return `${base} ${styles.uploadZoneDone}`;
    if (dragging) return `${base} ${styles.uploadZoneDragging}`;
    return base;
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

          {/* Subcategory */}
          <div className={styles.field}>
            <label className={styles.label}>Subcategoría</label>
            <input className={styles.input} value={subcategory} onChange={(e) => setSubcategory(e.target.value)} />
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

          {/* UOM */}
          <div className={styles.field}>
            <label className={styles.label}>UOM *</label>
            <input className={`${styles.input} ${fieldError('unit') ? styles.inputError : ''}`} value={unit} onChange={(e) => setUnit(e.target.value)} />
            {fieldError('unit') && <span className={styles.errorText}>{fieldError('unit')}</span>}
          </div>

          {/* Stock */}
          <div className={styles.field}>
            <label className={styles.label}>Stock *</label>
            <input className={`${styles.input} ${fieldError('stock') ? styles.inputError : ''}`} type="number" min="0" value={stock} onChange={(e) => setStock(e.target.value)} />
            {fieldError('stock') && <span className={styles.errorText}>{fieldError('stock')}</span>}
          </div>

          {/* Reorder point */}
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

          {/* Ubicación en estantería */}
          <div className={styles.field}>
            <label className={styles.label}>Ubicación en estantería</label>
            <div className={styles.locationRow}>
              <select
                className={styles.locationSelect}
                value={locShelf}
                onChange={e => { setLocShelf(e.target.value ? Number(e.target.value) : ''); setLocLevel(''); }}
              >
                <option value="">Sin estante</option>
                {[1, 2, 3].map(s => <option key={s} value={s}>Estante {s}</option>)}
              </select>
              <select
                className={styles.locationSelect}
                value={locLevel}
                onChange={e => setLocLevel(e.target.value ? Number(e.target.value) : '')}
                disabled={locShelf === ''}
              >
                <option value="">Sin nivel</option>
                {[1, 2, 3, 4].map(n => <option key={n} value={n}>N{n}</option>)}
              </select>
            </div>
          </div>

          {/* Foto — file upload widget */}
          <div className={styles.field}>
            <label className={styles.label}>
              {isEdit ? 'Foto' : 'Foto *'}
            </label>

            {/* Edit mode: show existing image with replace option */}
            {isEdit && !replacing && initialData?.imageUrl && (
              <div className={styles.existingImageBlock}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={driveProxyUrl(initialData.imageUrl)}
                  alt="Imagen actual del producto"
                  className={styles.existingImage}
                />
                <button type="button" className={styles.replaceBtn} onClick={handleReplaceClick}>
                  Reemplazar imagen
                </button>
              </div>
            )}

            {/* Upload zone (new items always; edit items when replacing) */}
            {showUploadZone && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className={styles.hiddenInput}
                  onChange={onInputChange}
                />
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className={styles.hiddenInput}
                  onChange={onInputChange}
                />
                <div
                  className={uploadZoneClass()}
                  onClick={() => uploadState === 'done' && fileInputRef.current?.click()}
                  onDragOver={onDragOver}
                  onDragLeave={onDragLeave}
                  onDrop={onDrop}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
                  aria-label="Subir imagen"
                >
                  {uploadState === 'idle' && (
                    <div className={styles.uploadOptions}>
                      <div className={styles.uploadOptionsRow}>
                        <button
                          type="button"
                          className={styles.uploadOptionBtn}
                          onClick={(e) => { e.stopPropagation(); cameraInputRef.current?.click(); }}
                        >
                          <Camera size={22} />
                          <span>Tomar foto</span>
                        </button>
                        <div className={styles.uploadOptionDivider} />
                        <button
                          type="button"
                          className={styles.uploadOptionBtn}
                          onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                        >
                          <Upload size={22} />
                          <span>Subir imagen</span>
                        </button>
                      </div>
                      <span className={styles.uploadHint}>JPG, PNG, WEBP · máx. 10 MB</span>
                    </div>
                  )}

                  {uploadState === 'uploading' && (
                    <>
                      <div className={styles.uploadSpinner} />
                      <span className={styles.uploadHint}>Subiendo…</span>
                    </>
                  )}

                  {uploadState === 'done' && previewSrc && (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={previewSrc} alt="Vista previa" className={styles.uploadPreview} />
                      <span className={styles.uploadHint}>
                        Imagen lista · haz clic para cambiar
                      </span>
                    </>
                  )}

                  {uploadState === 'error' && (
                    <>
                      <ImageIcon size={20} color="var(--color-danger)" />
                      <span className={styles.uploadErrorMsg}>{uploadError}</span>
                      <button
                        type="button"
                        className={styles.retryLink}
                        onClick={(e) => { e.stopPropagation(); handleRetry(); }}
                      >
                        Reintentar
                      </button>
                    </>
                  )}
                </div>
              </>
            )}

            {fieldError('imageUrl') && (
              <span className={styles.errorText}>{fieldError('imageUrl')}</span>
            )}
          </div>

          {/* Ficha técnica */}
          <div className={styles.field}>
            <label className={styles.label}>Ficha técnica (URL)</label>
            <input
              className={styles.input}
              value={techSheetUrl}
              onChange={(e) => setTechSheetUrl(e.target.value)}
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
          <button className={styles.cancelBtn} onClick={onClose} disabled={saving}>Cancelar</button>
          <button className={styles.saveBtn} onClick={handleSave} disabled={saveDisabled}>
            {saving
              ? 'Guardando…'
              : uploadState === 'uploading'
                ? 'Subiendo imagen…'
                : isEdit
                  ? 'Guardar cambios'
                  : 'Agregar producto'}
          </button>
        </div>
      </div>
    </>
  );
}
