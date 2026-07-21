import LoginForm from '@/components/LoginForm';
import styles from './page.module.css';

export const metadata = {
  title: 'Acesso Restrito | Delta Empreendimentos',
  description: 'Sistema interno de análise e business intelligence para alta gestão.',
};

export default function Home() {
  return (
    <main className={styles.main}>
      {/* Background with Dark Overlay */}
      <div className={styles.background} aria-hidden="true" />
      <div className={styles.overlay} aria-hidden="true" />

      {/* Main Content */}
      <div className={styles.content}>
        <div className={styles.header}>
          {/* Logo - Using standard img tag to avoid remote patterns config for external URL */}
          <img 
            src="https://deltaempreendimentos.com.br/wp-content/uploads/2026/03/LOGO-BRANCA-DELTA.png.webp"
            alt="Delta Empreendimentos Logo"
            className={styles.logo}
          />
          
          <p className={styles.description}>
            Plataforma corporativa de <span className={styles.highlight}>Business Intelligence</span>. 
            <br />
            Faça login para acessar o Assistente de Inteligência Artificial e consultar os dados financeiros e de recursos humanos da empresa.
          </p>
        </div>

        <LoginForm />
      </div>

      <footer className={styles.footer}>
        &copy; {new Date().getFullYear()} Delta Empreendimentos. Sistema restrito para Diretores e Sócios.
      </footer>
    </main>
  );
}
