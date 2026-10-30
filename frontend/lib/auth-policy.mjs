export function allowedUser(user) {
  return Boolean(user?.id && !user.is_anonymous
    && ['viewer', 'admin'].includes(user.app_metadata?.delta_role));
}

export function sameOrigin(request) {
  // Next.js pode reconstruir request.url com a origem interna do servidor.
  // Comparar com a origem pública configurada, nunca com Host fornecido pelo cliente.
  try {
    const expected = new URL(process.env.DELTA_APP_ORIGIN);
    const local = expected.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(expected.hostname);
    if ((!local && expected.protocol !== 'https:') || expected.username || expected.password
      || expected.pathname !== '/' || expected.search || expected.hash) return false;
    return request.headers.get('origin') === expected.origin;
  } catch { return false; }
}

export function authConfiguration() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  try {
    const parsed = new URL(url);
    const local = parsed.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname);
    if ((!local && parsed.protocol !== 'https:') || parsed.username || parsed.password
      || parsed.pathname !== '/' || parsed.search || parsed.hash) return null;
    return { url: parsed.origin, key };
  } catch { return null; }
}

export function sessionCookieOptions(options) {
  return { ...options, httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' };
}
