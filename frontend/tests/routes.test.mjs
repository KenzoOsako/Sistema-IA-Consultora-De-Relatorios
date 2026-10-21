import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

const virtual = (code) => 'data:text/javascript,' + encodeURIComponent(code);
const authStub = virtual('export async function authorizedUser() { return globalThis.__authorization; }');
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === '@/lib/auth') return { url: authStub, shortCircuit: true };
    if (specifier === '@/lib/auth-policy.mjs') return nextResolve(new URL('../lib/auth-policy.mjs', import.meta.url).href, context);
    if (specifier === 'next/server') return nextResolve('next/server.js', context);
    return nextResolve(specifier, context);
  },
});
const { POST } = await import('../app/api/chat/route.js');
process.env.DELTA_APP_ORIGIN = 'https://delta.test';
const request = () => new Request('https://delta.test/api/chat', {
  method: 'POST', headers: { Origin: 'https://delta.test', 'Content-Type': 'application/json' },
  body: JSON.stringify({ messages: [{ role: 'user', content: 'synthetic question' }] }),
});

test('chat never forwards anonymous, forbidden or unavailable sessions', async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error('unexpected call'); };
  try {
    for (const status of [401, 403, 503]) {
      globalThis.__authorization = { status };
      assert.equal((await POST(request())).status, status);
    }
    assert.equal(calls, 0);
  } finally { globalThis.fetch = original; }
});

test('authorized chat forwards only the verified session token', async () => {
  const originalFetch = globalThis.fetch;
  const originalBase = process.env.DELTA_API_URL;
  process.env.DELTA_API_URL = 'https://backend.test';
  globalThis.__authorization = { status: 200, client: { auth: { getSession: async () => ({
    data: { session: { access_token: 'synthetic-user-token' } }, error: null,
  }) } } };
  globalThis.fetch = async (url, options) => {
    assert.equal(url, 'https://backend.test/api/chat');
    assert.equal(options.headers.Authorization, 'Bearer synthetic-user-token');
    assert.equal(options.redirect, 'error');
    assert.equal(options.cache, 'no-store');
    return Response.json({ role: 'assistant', content: 'synthetic response' });
  };
  try {
    const result = await POST(request());
    assert.equal(result.status, 200);
    assert.equal(result.headers.get('cache-control'), 'no-store');
    assert.equal((await result.json()).content, 'synthetic response');
  } finally {
    globalThis.fetch = originalFetch;
    if (originalBase === undefined) delete process.env.DELTA_API_URL; else process.env.DELTA_API_URL = originalBase;
  }
});

test('cross-origin chat is rejected before authorization and forwarding', async () => {
  const result = await POST(new Request('https://delta.test/api/chat', {
    method: 'POST', headers: { Origin: 'https://other.test' }, body: '{}',
  }));
  assert.equal(result.status, 403);
});
