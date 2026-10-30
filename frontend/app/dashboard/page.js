import { requireUser } from '@/lib/auth';
import Chatbot from '@/components/Chatbot';

export const metadata = {
  title: 'Assistente IA | Delta Empreendimentos',
  description: 'Assistente de Business Intelligence.',
};

export default async function DashboardPage() {
  await requireUser();
  return <Chatbot />;
}
