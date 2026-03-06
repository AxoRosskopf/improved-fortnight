import Header from './Header';
import styles from './AppLayout.module.css';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.shell}>
      <Header />
      <main className={styles.main}>{children}</main>
    </div>
  );
}
