'use client';

import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import styles from './Sidebar.module.css';

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();

  const handleLogout = () => {
    router.push('/');
  };

  return (
    <aside className={styles.sidebar}>
      <div className={styles.accountSection}>
        <div className={styles.avatar}>
          {/* Initials or image */}
          KC
        </div>
        <div className={styles.userInfo}>
          <h3 className={styles.userName}>Kenzo Camargo</h3>
          <span className={styles.userRole}>Diretor de Vendas</span>
        </div>
      </div>

      <nav className={styles.nav}>
        <ul className={styles.navList}>
          <li>
            <Link href="/dashboard" className={`${styles.navBtn} ${pathname === '/dashboard' ? styles.active : ''}`}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
              </svg>
              Assistente IA
            </Link>
          </li>
          <li>
            <Link href="/dashboard/financeiro" className={`${styles.navBtn} ${pathname === '/dashboard/financeiro' ? styles.active : ''}`}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="20" x2="18" y2="10"></line>
                <line x1="12" y1="20" x2="12" y2="4"></line>
                <line x1="6" y1="20" x2="6" y2="14"></line>
              </svg>
              Dashboard Financeiro
            </Link>
          </li>
          <li>
            <Link href="/dashboard/rh" className={`${styles.navBtn} ${pathname === '/dashboard/rh' ? styles.active : ''}`}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
              Recursos Humanos
            </Link>
          </li>
        </ul>
      </nav>

      <div className={styles.footer}>
        <button className={styles.logoutBtn} onClick={handleLogout}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
            <polyline points="16 17 21 12 16 7"></polyline>
            <line x1="21" y1="12" x2="9" y2="12"></line>
          </svg>
          Sair da Plataforma
        </button>
      </div>
    </aside>
  );
}
