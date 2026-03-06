'use client';

import { ScanLine } from 'lucide-react';
import styles from './ScanFab.module.css';

interface ScanFabProps {
  onClick: () => void;
}

export default function ScanFab({ onClick }: ScanFabProps) {
  return (
    <button className={styles.fab} onClick={onClick} aria-label="Escanear QR">
      <ScanLine size={24} />
    </button>
  );
}
