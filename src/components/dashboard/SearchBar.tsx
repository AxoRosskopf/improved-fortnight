'use client';

import { Search, SlidersHorizontal } from 'lucide-react';
import Input from '@/components/ui/Input';
import styles from './SearchBar.module.css';

interface SearchBarProps {
  value?: string;
  onChange?: (value: string) => void;
  onFilterClick?: () => void;
  filterActive?: boolean;
}

export default function SearchBar({ value = '', onChange, onFilterClick, filterActive }: SearchBarProps) {
  return (
    <div className={styles.wrapper}>
      <div className={styles.inputWrapper}>
        <Input
          placeholder="Search products..."
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          iconLeft={<Search size={16} />}
          aria-label="Search products"
        />
      </div>
      <button
        className={styles.filterBtn}
        aria-label="Filter"
        aria-pressed={filterActive}
        onClick={onFilterClick}
        style={{ color: filterActive ? 'var(--accent)' : undefined }}
      >
        <SlidersHorizontal size={18} />
      </button>
    </div>
  );
}
