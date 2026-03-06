import { Boxes } from 'lucide-react';
import styles from './Header.module.css';

export default function Header() {
  return (
    <header className={styles.header}>
      <span className={styles.logoIcon}>
        <Boxes size={18} />
      </span>
      <span className={styles.logoText}>Inventary</span>
    </header>
  );
}
