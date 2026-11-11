import styles from '../page.module.css';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Recuperar senha | Delta Empreendimentos',
  robots: { index: false, follow: false },
};

export default function RecoveryLayout({ children }) {
  return (
    <main className={styles.main}>
      <div className={styles.background} aria-hidden="true" />
      <div className={styles.overlay} aria-hidden="true" />
      <div className={styles.content}>{children}</div>
    </main>
  );
}
