'use client';

import { X } from 'lucide-react';
import type { InventoryItem } from '@/lib/types';
import styles from './CsvPreviewModal.module.css';

interface CsvPreviewModalProps {
  preview: InventoryItem[];
  errors: Array<{ row: number; message: string }>;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function CsvPreviewModal({ preview, errors, onConfirm, onCancel }: CsvPreviewModalProps) {
  return (
    <>
      <div className={styles.backdrop} onClick={onCancel} aria-hidden="true" />
      <div className={styles.modal} role="dialog" aria-label="Revisar importación CSV">
        <div className={styles.header}>
          <span className={styles.title}>Revisar importación</span>
          <button className={styles.closeBtn} onClick={onCancel} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        <p className={styles.summary}>
          {preview.length} producto{preview.length !== 1 ? 's' : ''} detectado{preview.length !== 1 ? 's' : ''}
          {errors.length > 0 && (
            <span className={styles.errorCount}> — {errors.length} error{errors.length !== 1 ? 'es' : ''}</span>
          )}
        </p>

        {errors.length > 0 && (
          <div className={styles.errorList}>
            {errors.map((e, i) => (
              <p key={i} className={styles.errorItem}>
                Fila {e.row}: {e.message}
              </p>
            ))}
          </div>
        )}

        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Categoría</th>
                <th>Stock</th>
                <th>P. Compra</th>
                <th>P. Venta</th>
              </tr>
            </thead>
            <tbody>
              {preview.map((item, i) => (
                <tr key={i}>
                  <td>{item.name}</td>
                  <td>{item.category}</td>
                  <td>{item.stock}</td>
                  <td>${item.purchasePrice?.toFixed(2) ?? '—'}</td>
                  <td>${item.salePrice?.toFixed(2) ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className={styles.actions}>
          <button className={styles.cancelBtn} onClick={onCancel}>Cancelar</button>
          <button className={styles.confirmBtn} onClick={onConfirm} disabled={preview.length === 0}>
            Confirmar importación
          </button>
        </div>
      </div>
    </>
  );
}
