// Fluxo HTTP real do Next.js com Auth e API sintéticos somente em loopback.
// Execute após npm run build: node tests/auth-flow.mjs
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';

const user = {
  id: '00000000-0000-4000-8000-000000000001', aud: 'authenticated', role: 'authenticated',
  email: 'authorized@example.test', email_confirmed_at: '2026-01-01T00:00:00Z',
  created_at: '2026-01-01T00:00:00Z', is_anonymous: false,
  app_metadata: { delta_role: 'viewer' }, user_metadata: {}, identities: [],
};
const issued = new Map();
let chatCalls = 0;
const mock = createServer(async (req, res) => {
  const send = (value, status = 200) => {
    res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(value));
  };
  if (req.url.startsWith('/auth/v1/token') && req.method === 'POST') {
    let raw = ''; for await (const chunk of req) raw += chunk;
    const credentials = JSON.parse(raw);
    if (credentials.password !== 'synthetic-test-only') return send({ msg: 'invalid credentials' }, 400);
    const record = { ...user, email: credentials.email,
      app_metadata: credentials.email === user.email ? user.app_metadata : {} };
    const now = Math.floor(Date.now() / 1000);
    const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
    const token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: user.id, exp: now + 3600, iat: now, role: 'authenticated', email: record.email })}.synthetic`;
    issued.set(token, record);
    return send({ access_token: token, token_type: 'bearer', expires_in: 3600, expires_at: now + 3600,
      refresh_token: 'synthetic-refresh-token', user: record });
  }
  const token = req.headers.authorization?.replace(/^Bearer /, '');
  if (req.url === '/auth/v1/user') {
    return issued.has(token) ? send(issued.get(token)) : send({ msg: 'invalid token' }, 401);
  }
  if (req.url.startsWith('/auth/v1/logout')) {
    issued.delete(token); res.writeHead(204); return res.end();
  }
  if (req.url === '/api/chat') {
    if (!issued.has(token)) return send({ error: 'invalid token' }, 401);
    chatCalls++;
    return send({ role: 'assistant', content: 'synthetic response' });
  }
  return send({ error: 'not found' }, 404);
});

await new Promise(resolve => mock.listen(0, '127.0.0.1', resolve));
const mockOrigin = `http://127.0.0.1:${mock.address().port}`;
const portProbe = createServer();
await new Promise(resolve => portProbe.listen(0, '127.0.0.1', resolve));
const port = portProbe.address().port;
await new Promise(resolve => portProbe.close(resolve));
const origin = `http://127.0.0.1:${port}`;
const app = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', String(port)], {
  env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1', SUPABASE_URL: mockOrigin,
    SUPABASE_PUBLISHABLE_KEY: 'synthetic-publishable-key', DELTA_API_URL: mockOrigin, DELTA_APP_ORIGIN: origin },
  stdio: ['ignore', 'pipe', 'pipe'],
});
app.stdout.resume(); app.stderr.resume();
const jar = new Map();
async function request(path, { method = 'GET', body, cookie = true } = {}) {
  const response = await fetch(origin + path, {
    method, redirect: 'manual', headers: {
      Origin: origin, 'Content-Type': 'application/json',
      ...(cookie && jar.size ? { Cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; ') } : {}),
    }, body: body === undefined ? undefined : JSON.stringify(body),
  });
  for (const value of response.headers.getSetCookie()) {
    const pair = value.split(';')[0], at = pair.indexOf('=');
    const name = pair.slice(0, at), content = pair.slice(at + 1);
    if (!content || /max-age=0/i.test(value)) jar.delete(name); else jar.set(name, content);
  }
  return response;
}
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(origin)).ok) { ready = true; break; } } catch { /* startup */ }
    if (app.exitCode !== null) throw new Error('Next.js encerrou antes de iniciar.');
    await delay(100);
  }
  assert.ok(ready, 'Next.js iniciou');
  for (const path of ['/dashboard', '/dashboard/financeiro', '/dashboard/rh']) {
    const response = await request(path);
    assert.ok([307, 308].includes(response.status), 'página anônima deve redirecionar');
  }
  assert.equal((await request('/api/chat', { method: 'POST', body: { messages: [{ content: 'synthetic' }] } })).status, 401);
  assert.equal(chatCalls, 0);
  assert.equal((await request('/api/auth/login', { method: 'POST', body: {
    email: 'denied@example.test', password: 'synthetic-test-only',
  } })).status, 403);
  const login = await request('/api/auth/login', { method: 'POST', body: {
    email: user.email, password: 'synthetic-test-only',
  } });
  assert.equal(login.status, 200);
  assert.ok(login.headers.getSetCookie().some(value => /httponly/i.test(value)));
  const page = await request('/dashboard');
  assert.equal(page.status, 200);
  assert.ok((await page.text()).includes(user.email));
  const financial = await request('/dashboard/financeiro');
  assert.equal(financial.status, 200);
  const financialHtml = await financial.text();
  assert.equal(financialHtml.includes('app.powerbi.com/view'), false);
  assert.ok(financialHtml.includes('Simulação'));
  const chat = await request('/api/chat', { method: 'POST', body: { messages: [{ content: 'synthetic' }] } });
  assert.equal(chat.status, 200);
  assert.equal((await chat.json()).content, 'synthetic response');
  assert.equal(chatCalls, 1);
  assert.equal((await request('/api/auth/logout', { method: 'POST' })).status, 200);
  assert.ok([307, 308].includes((await request('/dashboard')).status));
  console.log('PASS: páginas anônimas bloqueadas; papel não permitido negado; login, cookie HttpOnly, dashboard, chat e logout verificados por HTTP com provedor sintético.');
} finally {
  app.kill('SIGTERM');
  if (app.exitCode === null) await once(app, 'exit');
  mock.closeAllConnections(); await new Promise(resolve => mock.close(resolve));
}
