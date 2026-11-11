import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { authConfiguration, sessionCookieOptions } from './auth-policy.mjs';

const recoveryCookie = process.env.NODE_ENV === 'production'
  ? '__Host-delta-recovery' : 'delta-recovery';

export async function createAuthClient({ writable = false, recovery = false } = {}) {
  const config = authConfiguration();
  if (!config) return null;
  const jar = await cookies();
  return createServerClient(config.url, config.key, {
    ...(recovery ? { cookieOptions: { name: recoveryCookie, path: '/' } } : {}),
    cookies: {
      getAll: () => jar.getAll(),
      setAll(values) {
        try {
          values.forEach(({ name, value, options }) => {
            const cookie = sessionCookieOptions(options);
            if (recovery && cookie.maxAge !== 0) cookie.maxAge = 15 * 60;
            jar.set(name, value, cookie);
          });
        } catch (error) {
          if (writable) throw error;
          // Server Components só leem cookies; proxy.js persiste a renovação.
        }
      },
    },
  });
}

export async function clearRecoveryCookies() {
  const jar = await cookies();
  for (const { name } of jar.getAll()) {
    if (name === recoveryCookie || name.startsWith(`${recoveryCookie}.`)
      || name.startsWith(`${recoveryCookie}-`)) {
      jar.set(name, '', sessionCookieOptions({ path: '/', maxAge: 0 }));
    }
  }
}
