'use client';

import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import type { InventoryItem } from '@/lib/types';
import styles from './QrScannerModal.module.css';

interface QrScannerModalProps {
  products: InventoryItem[];
  onFound: (product: InventoryItem) => void;
  onNotFound: (code: string) => void;
  onClose: () => void;
}

const READER_ID = 'qr-scanner-reader';

export default function QrScannerModal({ products, onFound, onNotFound, onClose }: QrScannerModalProps) {
  const [error, setError] = useState<string | null>(null);
  const scannerRef = useRef<import('html5-qrcode').Html5Qrcode | null>(null);
  const resolvedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function startScanner() {
      const { Html5Qrcode } = await import('html5-qrcode');
      if (cancelled) return;

      const scanner = new Html5Qrcode(READER_ID);
      scannerRef.current = scanner;

      try {
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText) => {
            if (resolvedRef.current) return;
            resolvedRef.current = true;

            const found = products.find((p) => p.qrCode === decodedText);
            scanner.stop().catch(() => {}).finally(() => {
              if (found) {
                onFound(found);
              } else {
                onNotFound(decodedText);
              }
            });
          },
          () => {}, // partial detection — ignore
        );
      } catch (err) {
        setError('No se pudo acceder a la cámara.');
        console.error(err);
      }
    }

    startScanner();

    return () => {
      cancelled = true;
      scannerRef.current?.stop().catch(() => {});
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleClose() {
    scannerRef.current?.stop().catch(() => {});
    onClose();
  }

  return (
    <>
      <div className={styles.backdrop} onClick={handleClose} aria-hidden="true" />
      <div className={styles.modal} role="dialog" aria-label="Escáner QR">
        <div className={styles.header}>
          <span className={styles.title}>Escanear código QR</span>
          <button className={styles.closeBtn} onClick={handleClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        <div className={styles.scannerContainer}>
          <div id={READER_ID} />
        </div>

        {error && <p className={styles.errorMsg}>{error}</p>}
      </div>
    </>
  );
}
