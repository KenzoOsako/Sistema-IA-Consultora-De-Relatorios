import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import { authConfiguration, sessionCookieOptions } from './lib/auth-policy.mjs';

export async function proxy(request) {
  let response = NextResponse.next({ request });
  response.headers.set('Cache-Control', 'private, no-store');
  const config = authConfiguration();
  if (!config) return response;
  const client = createServerClient(config.url, config.key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(values, headers) {
        values.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        values.forEach(({ name, value, options }) => response.cookies.set(name, value, sessionCookieOptions(options)));
        Object.entries(headers ?? {}).forEach(([name, value]) => response.headers.set(name, value));
        response.headers.set('Cache-Control', 'private, no-store');
      },
    },
  });
  try { await client.auth.getUser(); } catch { /* Páginas e APIs negam acesso. */ }
  return response;
}

export const config = { matcher: ['/dashboard/:path*', '/api/:path*'] };
