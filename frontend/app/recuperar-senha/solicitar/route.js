import { appOrigin, sameOrigin } from '@/lib/auth-policy.mjs';
import { clearRecoveryCookies, createAuthClient } from '@/lib/supabase';
import { recoveryPath, recoveryReply } from '@/lib/recovery';

export async function POST(request) {
  if (!sameOrigin(request)) return recoveryReply(403);
  const payload = await request.json().catch(() => null);
  const email = typeof payload?.email === 'string' ? payload.email.trim() : '';
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+$/.test(email)) return recoveryReply(400);

  try {
    await clearRecoveryCookies();
    const client = await createAuthClient({ writable: true, recovery: true });
    if (!client) return recoveryReply(503);
    const { error } = await client.auth.resetPasswordForEmail(email, {
      redirectTo: new URL(`${recoveryPath}/confirmar`, appOrigin()).href,
    });
    if (error) console.warn('Supabase recusou uma solicitação de recuperação.', error.status);
    // A resposta não revela se o endereço está cadastrado ou autorizado pelo SMTP.
    return recoveryReply(200);
  } catch {
    return recoveryReply(503);
  }
}
