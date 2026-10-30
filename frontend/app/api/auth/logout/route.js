import { createAuthClient } from '@/lib/supabase';
import { sameOrigin } from '@/lib/auth-policy.mjs';

export async function POST(request) {
  const headers = { 'Cache-Control': 'no-store' };
  if (!sameOrigin(request)) return Response.json({ error: 'Origem não permitida.' }, { status: 403, headers });
  try {
    const client = await createAuthClient({ writable: true });
    if (!client) return Response.json({ error: 'Autenticação indisponível.' }, { status: 503, headers });
    const { error } = await client.auth.signOut({ scope: 'local' });
    if (error) return Response.json({ error: 'Não foi possível sair.' }, { status: 503, headers });
    return Response.json({ ok: true }, { headers });
  } catch { return Response.json({ error: 'Não foi possível sair.' }, { status: 503, headers }); }
}
