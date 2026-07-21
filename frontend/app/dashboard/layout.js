import Sidebar from '@/components/Sidebar';
import styles from './dashboard.module.css';

export default function DashboardLayout({ children }) {
  return (
    <div className={styles.layout}>
      <Sidebar />
      
      <main className={styles.mainArea}>
        <header className={styles.header}>
          <img 
            src="https://deltaempreendimentos.com.br/wp-content/uploads/2026/03/LOGO-BRANCA-DELTA.png.webp" 
            alt="Delta Empreendimentos" 
            className={styles.logo}
          />
        </header>
        
        <div className={styles.content}>
          {children}
        </div>
      </main>
    </div>
  );
}
