import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { authConfiguration, sessionCookieOptions } from './auth-policy.mjs';

export async function createAuthClient({ writable = false } = {}) {
  const config = authConfiguration();
  if (!config) return null;
  const jar = await cookies();
  return createServerClient(config.url, config.key, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll(values) {
        try {
          values.forEach(({ name, value, options }) => jar.set(name, value, sessionCookieOptions(options)));
        } catch (error) {
          if (writable) throw error;
          // Server Components só leem cookies; proxy.js persiste a renovação.
        }
      },
    },
  });
}
