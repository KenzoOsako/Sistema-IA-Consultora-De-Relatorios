import 'server-only';
import { redirect } from 'next/navigation';
import { createAuthClient } from './supabase';
import { allowedUser } from './auth-policy.mjs';

export async function authorizedUser() {
  try {
    const client = await createAuthClient();
    if (!client) return { status: 503 };
    // getUser verifica a sessão no Auth; não confiar no usuário salvo em cookies.
    const { data, error } = await client.auth.getUser();
    if (error || !data?.user) return { status: 401 };
    if (!allowedUser(data.user)) return { status: 403 };
    return { status: 200, user: data.user, client };
  } catch { return { status: 503 }; }
}

export async function requireUser() {
  const result = await authorizedUser();
  if (result.status !== 200) redirect('/');
  return result;
}
