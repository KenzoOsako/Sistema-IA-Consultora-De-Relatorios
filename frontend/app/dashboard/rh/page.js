import { requireUser } from '@/lib/auth';
export const metadata = {
  title: 'Recursos Humanos | Delta Empreendimentos',
};

export default async function RHPage() {
  await requireUser();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'center', alignItems: 'center', textAlign: 'center', opacity: 0.7 }}>
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ marginBottom: '1rem', color: 'var(--color-primary)' }}>
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
        <circle cx="9" cy="7" r="4"></circle>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
      </svg>
      <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '2rem', marginBottom: '0.5rem' }}>Recursos Humanos</h2>
      <p style={{ fontFamily: 'var(--font-body)', maxWidth: '400px' }}>Este módulo está sendo atualizado com a base de dados de funcionários. Acesso restrito aos gestores de área.</p>
    </div>
  );
}
