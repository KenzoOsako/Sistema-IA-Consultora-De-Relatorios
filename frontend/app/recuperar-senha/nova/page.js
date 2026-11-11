import { redirect } from 'next/navigation';
import RecoveryForm from '@/components/RecoveryForm';
import { createAuthClient } from '@/lib/supabase';

export default async function NewPasswordPage() {
  const client = await createAuthClient({ recovery: true });
  const result = await client?.auth.getUser();
  if (!result?.data.user || result.error || result.data.user.is_anonymous) {
    redirect('/recuperar-senha?invalido=1');
  }
  return <RecoveryForm update />;
}
