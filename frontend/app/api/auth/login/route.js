import { createAuthClient } from '@/lib/supabase';
import { allowedUser, sameOrigin } from '@/lib/auth-policy.mjs';

const reply = (body, status) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export async function POST(request) {
  if (!sameOrigin(request)) return reply({ error: 'Origem não permitida.' }, 403);
  try {
    const client = await createAuthClient({ writable: true });
    if (!client) return reply({ error: 'Acesso temporariamente indisponível.' }, 503);
    const { email, password } = await request.json();
    if (typeof email !== 'string' || typeof password !== 'string'
      || !email.trim() || email.length > 254 || !password || password.length > 1024) {
      return reply({ error: 'Credenciais inválidas.' }, 400);
    }
    const { data, error } = await client.auth.signInWithPassword({ email: email.trim(), password });
    if (error || !data?.user) return reply({ error: 'Não foi possível entrar com essas credenciais.' }, 401);
    if (!allowedUser(data.user)) {
      await client.auth.signOut({ scope: 'local' });
      return reply({ error: 'Acesso não autorizado.' }, 403);
    }
    return reply({ ok: true }, 200);
  } catch { return reply({ error: 'Não foi possível entrar. Tente novamente.' }, 503); }
}
