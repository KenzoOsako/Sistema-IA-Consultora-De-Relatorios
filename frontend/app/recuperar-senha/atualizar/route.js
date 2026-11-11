import { sameOrigin } from '@/lib/auth-policy.mjs';
import { clearRecoveryCookies, createAuthClient } from '@/lib/supabase';
import { recoveryReply } from '@/lib/recovery';

export async function POST(request) {
  if (!sameOrigin(request)) return recoveryReply(403);
  const payload = await request.json().catch(() => null);
  const password = payload?.password;
  if (typeof password !== 'string' || !password
    || new TextEncoder().encode(password).length > 72) return recoveryReply(400);

  try {
    const client = await createAuthClient({ writable: true, recovery: true });
    if (!client) return recoveryReply(503);
    const { data, error } = await client.auth.getUser();
    if (error || !data.user || data.user.is_anonymous) return recoveryReply(401);
    const updated = await client.auth.updateUser({ password });
    if (updated.error) return recoveryReply([400, 422].includes(updated.error.status) ? 422 : 503);
    try {
      await client.auth.signOut({ scope: 'global' });
    } catch {
      // A senha já foi atualizada. Limpe a sessão local mesmo se o logout remoto falhar.
    } finally {
      await clearRecoveryCookies();
    }
    return recoveryReply(200);
  } catch {
    return recoveryReply(503);
  }
}
