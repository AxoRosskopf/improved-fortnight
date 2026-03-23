'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import type { InventoryItem, StockStatus } from '@/lib/types';
import { driveProxyUrl } from '@/lib/url-utils';
import styles from './ProductDetailModal.module.css';

function deriveStatus(item: InventoryItem): StockStatus {
  if (item.stock === 0) return 'out-of-stock';
  if (item.stock <= item.reorderPoint) return 'low-stock';
  return 'in-stock';
}

const statusLabel: Record<StockStatus, string> = {
  'in-stock': 'In Stock',
  'low-stock': 'Low Stock',
  'out-of-stock': 'Out of Stock',
};

interface ProductDetailModalProps {
  product: InventoryItem;
  onEdit: () => void;
  onDelete?: () => void;
  onClose: () => void;
}

interface FieldRowProps {
  label: string;
  value?: string | number | null;
  isLink?: boolean;
}

function ImageRow({ label, url }: { label: string; url?: string | null }) {
  const [broken, setBroken] = useState(false);
  if (!url) return null;
  return (
    <div className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      <div className={styles.imageBlock}>
        {!broken && (
          <img
            src={driveProxyUrl(url)}
            alt="Foto del producto"
            className={styles.productImage}
            onError={() => setBroken(true)}
          />
        )}
        {broken && (
          <span className={styles.imageFallback}>No se pudo cargar la imagen</span>
        )}
        <a className={styles.fieldLink} href={url} target="_blank" rel="noopener noreferrer">
          Ver en Drive
        </a>
      </div>
    </div>
  );
}

function FieldRow({ label, value, isLink }: FieldRowProps) {
  if (value === undefined || value === null || value === '') return null;
  return (
    <div className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      {isLink ? (
        <a className={styles.fieldLink} href={String(value)} target="_blank" rel="noopener noreferrer">
          {String(value)}
        </a>
      ) : (
        <span className={styles.fieldValue}>{String(value)}</span>
      )}
    </div>
  );
}

export default function ProductDetailModal({ product, onEdit, onDelete, onClose }: ProductDetailModalProps) {
  const status = deriveStatus(product);
  const categoryLabel = product.category;

  return (
    <>
      <div className={styles.backdrop} onClick={onClose} aria-hidden="true" />
      <div className={styles.modal} role="dialog" aria-label={product.name}>
        <div className={styles.header}>
          <h2 className={styles.productName}>{product.name}</h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        <div className={styles.qrBlock}>
          <QRCodeSVG value={product.qrCode} size={160} />
        </div>

        <div className={styles.fields}>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Estado</span>
            <div className={styles.statusRow}>
              <span className={styles.badge} data-status={status}>{statusLabel[status]}</span>
            </div>
          </div>

          <FieldRow label="Categoría" value={categoryLabel} />
          <FieldRow label="Descripción" value={product.description} />
          <FieldRow label="Stock" value={`${product.stock} ${product.unit}`} />
          <FieldRow label="Punto de reorden" value={product.reorderPoint} />
          <FieldRow label="Precio de compra" value={`$${product.purchasePrice?.toFixed(2)}`} />
          <FieldRow label="Precio de venta" value={`$${product.salePrice?.toFixed(2)}`} />
          <FieldRow label="Notas" value={product.notes ?? ''} />
          <ImageRow label="Foto" url={product.imageUrl} />
          <FieldRow label="Ficha técnica" value={product.techSheetUrl ?? ''} isLink />
          <FieldRow label="Link de video" value={product.videoUrl ?? ''} isLink />
          <FieldRow label="Código QR" value={product.qrCode} />
        </div>

        <div className={styles.actions}>
          {onDelete && (
            <button
              className={styles.deleteBtn}
              onClick={() => {
                if (window.confirm(`¿Eliminar "${product.name}"? Esta acción no se puede deshacer.`)) {
                  onDelete();
                }
              }}
            >
              Eliminar
            </button>
          )}
          <button className={styles.editBtn} onClick={onEdit}>
            Editar
          </button>
        </div>
      </div>
    </>
  );
}
