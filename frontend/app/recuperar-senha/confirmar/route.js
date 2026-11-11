import { appOrigin } from '@/lib/auth-policy.mjs';
import { clearRecoveryCookies, createAuthClient } from '@/lib/supabase';
import { recoveryHeaders, recoveryPath, recoveryReply } from '@/lib/recovery';

export async function GET(request) {
  const origin = appOrigin();
  if (!origin) return recoveryReply(503);
  const invalid = new URL(`${recoveryPath}?invalido=1`, origin);
  const code = new URL(request.url).searchParams.get('code');
  if (!code || code.length > 512) {
    return new Response(null, { status: 303, headers: { ...recoveryHeaders, Location: invalid.href } });
  }

  let destination = invalid;
  try {
    const client = await createAuthClient({ writable: true, recovery: true });
    if (!client) return recoveryReply(503);
    const { data, error } = await client.auth.exchangeCodeForSession(code);
    if (!error && data.redirectType === 'recovery' && data.user && !data.user.is_anonymous) {
      destination = new URL(`${recoveryPath}/nova`, origin);
    } else if (!error) {
      await clearRecoveryCookies();
    }
  } catch {
    await clearRecoveryCookies();
  }
  return new Response(null, { status: 303, headers: { ...recoveryHeaders, Location: destination.href } });
}
