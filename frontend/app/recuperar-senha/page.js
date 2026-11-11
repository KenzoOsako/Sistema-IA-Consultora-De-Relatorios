import RecoveryForm from '@/components/RecoveryForm';

export default async function RecoveryPage({ searchParams }) {
  const { invalido } = await searchParams;
  return <RecoveryForm invalid={invalido === '1'} />;
}
