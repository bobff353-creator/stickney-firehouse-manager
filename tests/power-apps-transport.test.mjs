import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
import { powerAppsOrigin, powerAppsRequest, powerAppsCorsHeaders, portalPinCookieOptions } from '../app/power-apps-request.ts';
import { sameOriginAuthRequest } from '../app/request-security.ts';

const allowed = 'https://code-app.fixture.test';
const originalOrigins = process.env.POWER_APPS_ALLOWED_ORIGINS;
process.env.POWER_APPS_ALLOWED_ORIGINS = allowed;
test.after(() => { if (originalOrigins === undefined) delete process.env.POWER_APPS_ALLOWED_ORIGINS; else process.env.POWER_APPS_ALLOWED_ORIGINS = originalOrigins; });
const request = (origin, headers = {}) => new Request('https://backend.fixture.test/api/logbook', { headers: { ...(origin ? { origin } : {}), ...headers } });
const marked = { 'x-firehouse-client': 'power-apps-v1' };

test('cross-origin transport requires the exact configured HTTPS origin and client marker', () => {
  for (const origin of [undefined, 'null', 'https://evil.test', `${allowed}.evil.test`, `${allowed}/`, 'http://code-app.fixture.test', 'https://code-app.fixture.test:444']) {
    assert.equal(powerAppsOrigin(request(origin, marked)), null);
    assert.equal(powerAppsRequest(request(origin, marked)), false);
    assert.equal(sameOriginAuthRequest(request(origin, marked)), false);
    assert.equal(powerAppsCorsHeaders(request(origin, marked)).has('access-control-allow-origin'), false);
  }
  assert.equal(powerAppsRequest(request(allowed)), false);
  assert.equal(powerAppsRequest(request(allowed, marked)), true);
  assert.equal(sameOriginAuthRequest(request(allowed, marked)), true);
});

test('the PIN stays HttpOnly and partitioned only for the approved Code App', () => {
  const approved = portalPinCookieOptions(request(allowed, marked), 1800);
  assert.equal(approved.httpOnly, true); assert.equal(approved.secure, true);
  assert.equal(approved.sameSite, 'none'); assert.equal(approved.partitioned, true);
  for (const req of [request(undefined), request('https://evil.test', marked), request(allowed)]) {
    const options = portalPinCookieOptions(req, 0);
    assert.equal(options.sameSite, 'lax'); assert.equal(options.partitioned, undefined);
    assert.equal(options.httpOnly, true); assert.equal(options.maxAge, 0);
  }
  const cors = powerAppsCorsHeaders(request(allowed));
  assert.equal(cors.get('access-control-allow-origin'), allowed);
  assert.equal(cors.get('access-control-allow-credentials'), 'true');
  assert.match(cors.get('vary'), /Origin/);
});

function module(path, mocks, globals = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, require: name => { assert.ok(name in mocks, name); return mocks[name]; }, URL, Headers, Request, Response, Error, ...globals });
  return exports;
}

test('a cross-origin session cannot use an elevated key or skip Supabase verification', async () => {
  let created = 0, supplied;
  const sdk = { createClient: (url, key, options) => {
    created++; assert.equal(url, 'https://independent.fixture.test'); assert.equal(key, 'fixture-publishable');
    assert.equal(options.auth.persistSession, false);
    return { auth: { setSession: async value => { supplied = value; return { data: {}, error: { status: 401 } }; } } };
  } };
  const api = module('app/power-apps-session.ts', {
    'server-only': {}, '@supabase/supabase-js': sdk,
    './power-apps-request': { powerAppsRequest }, './auth-failure-policy': { definitiveAuthFailure: value => value?.status === 401 },
  });
  assert.equal(await api.powerAppsSessionClient(request('https://evil.test', marked), 'ignored', 'ignored'), null);
  assert.equal(created, 0);
  await assert.rejects(api.powerAppsSessionClient(request(allowed, marked), 'ignored', 'ignored'), error => error.status === 401);
  assert.equal(created, 0);
  await assert.rejects(api.powerAppsSessionClient(request(allowed, { ...marked, authorization: 'Bearer fixture.invalid.signature', 'x-firehouse-refresh-token': 'fixture-refresh' }), 'https://independent.fixture.test', 'fixture-publishable'), error => error.status === 401);
  assert.deepEqual(JSON.parse(JSON.stringify(supplied)), { access_token: 'fixture.invalid.signature', refresh_token: 'fixture-refresh' });
});

test('the client preserves request bytes and never sends member tokens to unrelated destinations', async () => {
  const calls = [];
  const window = { fetch: async (input, init) => { const req = new Request(input, init); calls.push({ url: req.url, method: req.method, headers: req.headers, body: await req.text(), credentials: req.credentials }); return Response.json({ ok: true }); } };
  const api = module('power-apps/transport.ts', { './supabase-browser': { getSupabaseBrowserClient: () => ({ auth: { getSession: async () => ({ data: { session: { access_token: 'fixture-user-token', refresh_token: 'fixture-refresh' } } }) } }) } }, { window, location: new URL(`${allowed}/runtime/index.html`) });
  api.installPowerAppsTransport('https://stickney-power-apps-review.vercel.app');
  await window.fetch('/api/logbook?date=2026-11-17', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"version":3,"notes":"keep exact bytes"}' });
  assert.equal(calls[0].url, 'https://stickney-power-apps-review.vercel.app/api/logbook?date=2026-11-17');
  assert.equal(calls[0].method, 'POST'); assert.equal(calls[0].body, '{"version":3,"notes":"keep exact bytes"}');
  assert.equal(calls[0].headers.get('authorization'), 'Bearer fixture-user-token');
  assert.equal(calls[0].credentials, 'include');
  for (const url of ['https://external.fixture.test/api/logbook', 'https://datqzdndkrfyovhwppuq.supabase.co/auth/v1/user', `${allowed}/icons/pwa-96.png`]) await window.fetch(url);
  for (const call of calls.slice(1)) { assert.equal(call.headers.has('authorization'), false); assert.equal(call.headers.has('x-firehouse-refresh-token'), false); }
});
