import { requireUser } from '@/lib/auth';
import FinanceiroDashboard from '@/components/FinanceiroDashboard';

export const metadata = {
  title: 'Dashboard Financeiro | Delta Empreendimentos',
};

export default async function FinanceiroPage() {
  await requireUser();
  return <FinanceiroDashboard />;
}
