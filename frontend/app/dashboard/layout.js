import { requireUser } from '@/lib/auth';
import Sidebar from '@/components/Sidebar';
import styles from './dashboard.module.css';

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({ children }) {
  const { user } = await requireUser();
  return (
    <div className={styles.layout}>
      <Sidebar email={user.email} role={user.app_metadata.delta_role} />
      
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
