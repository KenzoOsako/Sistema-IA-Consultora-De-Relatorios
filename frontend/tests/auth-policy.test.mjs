import test from 'node:test';
import assert from 'node:assert/strict';
import { allowedUser, sameOrigin, authConfiguration, sessionCookieOptions } from '../lib/auth-policy.mjs';

test('only server-managed app metadata grants access', () => {
  assert.equal(allowedUser(null), false);
  assert.equal(allowedUser({ id: 'user', user_metadata: { delta_role: 'admin' } }), false);
  assert.equal(allowedUser({ id: 'user', is_anonymous: true, app_metadata: { delta_role: 'admin' } }), false);
  assert.equal(allowedUser({ id: 'user', app_metadata: { delta_role: 'owner' } }), false);
  for (const role of ['viewer', 'admin']) assert.equal(allowedUser({ id: 'user', app_metadata: { delta_role: role } }), true);
});

test('state-changing requests need the same origin', () => {
  const previous = process.env.DELTA_APP_ORIGIN;
  process.env.DELTA_APP_ORIGIN = 'https://delta.test';
  try {
  assert.equal(sameOrigin(new Request('https://delta.test/api/chat')), false);
  assert.equal(sameOrigin(new Request('https://delta.test/api/chat', { headers: { Origin: 'https://evil.test' } })), false);
  assert.equal(sameOrigin(new Request('https://delta.test/api/chat', { headers: { Origin: 'https://delta.test' } })), true);
  assert.equal(sameOrigin(new Request('http://internal:3000/api/chat', { headers: { Origin: 'https://delta.test' } })), true);
  delete process.env.DELTA_APP_ORIGIN;
  assert.equal(sameOrigin(new Request('https://delta.test/api/chat', { headers: { Origin: 'https://delta.test' } })), false);
  } finally {
    if (previous === undefined) delete process.env.DELTA_APP_ORIGIN; else process.env.DELTA_APP_ORIGIN = previous;
  }
});

test('missing and unsafe configuration fails closed', () => {
  const old = { url: process.env.SUPABASE_URL, key: process.env.SUPABASE_PUBLISHABLE_KEY };
  try {
    process.env.SUPABASE_PUBLISHABLE_KEY = 'synthetic-key';
    for (const value of ['', 'http://remote.test', 'https://user:pass@auth.test', 'https://auth.test/path', 'https://auth.test/?x=1']) {
      process.env.SUPABASE_URL = value;
      assert.equal(authConfiguration(), null);
    }
    process.env.SUPABASE_URL = 'https://auth.test';
    assert.deepEqual(authConfiguration(), { url: 'https://auth.test', key: 'synthetic-key' });
  } finally {
    for (const [key, value] of [['SUPABASE_URL', old.url], ['SUPABASE_PUBLISHABLE_KEY', old.key]]) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});

test('production cookies cannot opt out of HTTP-only and secure', () => {
  const previous = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = 'production';
    const options = sessionCookieOptions({ httpOnly: false, secure: false, sameSite: 'none', path: '/' });
    assert.equal(options.httpOnly, true);
    assert.equal(options.secure, true);
    assert.equal(options.sameSite, 'lax');
  } finally {
    if (previous === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previous;
  }
});
