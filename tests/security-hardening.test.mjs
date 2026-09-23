import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { webcrypto } from 'node:crypto';
import { sameOriginAuthRequest, safeReturnPath } from '../app/request-security.ts';
import { trustedPushEndpoint, validPushKeys, assertTrustedPushSubscription } from '../app/push-subscription-security.ts';
import { isSafePhoto } from '../app/upload-security.ts';

function route(path, mocks = {}) {
  const source = fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8').replace(/^import[\s\S]*?;\r?\n/gm, '');
  const context = { exports: {}, Response, Request, URL, Headers, File, Blob, Buffer, crypto: webcrypto, process: { env: {} }, ...mocks };
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, context);
  return context.exports;
}

const endpoint = 'https://fcm.googleapis.com/fcm/send/test-subscription';
const p256dh = Buffer.from([4, ...Array(64).fill(1)]).toString('base64url');
const auth = Buffer.alloc(16, 1).toString('base64url');

test('push destinations reject internal services, lookalike domains and URL parser tricks', () => {
  for (const value of [endpoint, 'https://updates.push.services.mozilla.com/wpush/v2/example', 'https://web.push.apple.com/example', 'https://wns2-par02p.notify.windows.com/w/?token=example']) assert.equal(trustedPushEndpoint(value), true, value);
  for (const value of ['https://127.0.0.1', 'https://[::1]', 'https://169.254.169.254', 'https://localhost', 'https://example.com', 'http://fcm.googleapis.com/test', 'https://fcm.googleapis.com.evil.test/test', 'https://fcm.googleapis.com@evil.test/test', 'https://fcm.googleapis.com:8443/test', 'https://fcm.googleapis.com\\@evil.test/test', 'https://fcm.googleapis.com/test#fragment', 'https://fcm.googleapis.com./test', null]) assert.equal(trustedPushEndpoint(value), false, String(value));
  assert.equal(validPushKeys(p256dh, auth), true);
  assert.equal(validPushKeys('malformed', auth), false);
  assert.equal(validPushKeys(p256dh, ''), false);
});

test('push registration denies unsafe input before database access and retains member scoping', async () => {
  let writes = 0, values;
  const api = route('app/api/push/subscriptions/route.ts', {
    verifyPushRequest: async () => ({ ok: true, context: { grants: ['scheduling.view'], user: { id: 'fixture-user' }, department: { id: 'fixture-dept' } } }),
    sameOriginInventoryRequest: () => true,
    webPushPublicConfig: () => ({ configured: true }), trustedPushEndpoint, validPushKeys,
    ensureDatabase: async () => ({ prepare: () => ({ bind: (...args) => { values = args; return { run: async () => { writes++; } }; } }) }),
  });
  const post = body => api.POST(new Request('https://fixture.test/api/push/subscriptions', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) }));
  for (const bad of ['not-json', 'null', { endpoint: 'https://127.0.0.1/private', keys: { p256dh, auth } }, { endpoint, keys: { p256dh: 'bad', auth } }]) assert.equal((await post(bad)).status, 400);
  assert.equal(writes, 0);
  assert.equal((await post({ endpoint, keys: { p256dh, auth } })).status, 200);
  assert.equal(writes, 1);
  assert.equal(values[1], 'fixture-user');
  assert.equal(values[2], 'fixture-dept');
});

test('CAD and scheduling delivery reject previously stored unsafe destinations without networking', async () => {
  let sent = 0;
  const api = route('app/cad-push.ts', { assertTrustedPushSubscription, webpush: { setVapidDetails() {}, async sendNotification() { sent++; } }, process: { env: { WEB_PUSH_VAPID_PUBLIC_KEY: 'test', WEB_PUSH_VAPID_PRIVATE_KEY: 'test' } } });
  for (const send of [api.deliverCadPush, api.deliverSchedulerPush]) {
    await assert.rejects(send({ endpoint: 'https://127.0.0.1/private', p256dh, auth }, {}, 300), error => error.statusCode === 410);
    await send({ endpoint, p256dh, auth }, {}, 300);
  }
  assert.equal(sent, 2);
});

test('sign-in and activation require a same-origin browser request before reading credentials', async () => {
  assert.equal(sameOriginAuthRequest(new Request('http://localhost:6182/api/auth/login', { headers: { host: '127.0.0.1:6182', origin: 'http://127.0.0.1:6182' } })), true);
  assert.equal(sameOriginAuthRequest(new Request('https://fixture.test/api/auth/login', { headers: { origin: 'https://evil.test', 'x-forwarded-host': 'evil.test' } })), false);
  for (const path of ['app/api/auth/login/route.ts', 'app/api/auth/activate/route.ts']) {
    const api = route(path, { sameOriginAuthRequest });
    for (const headers of [{}, { origin: 'https://evil.test' }, { origin: 'https://fixture.test', 'sec-fetch-site': 'cross-site' }]) {
      assert.equal((await api.POST(new Request('https://fixture.test/api/auth/login', { method: 'POST', headers, body: '{}' }))).status, 403);
    }
    // Login reaches input validation. Retired self-activation remains closed.
    assert.equal((await api.POST(new Request('https://fixture.test/api/auth/login', { method: 'POST', headers: { origin: 'https://fixture.test' }, body: '{}' }))).status, path.includes('/activate/') ? 403 : 400);
  }
});

test('confirmation links cannot redirect to another site through slashes, backslashes or controls', () => {
  for (const path of [null, '//evil.test', '/\\evil.test', '/\t/evil.test', 'https://evil.test', 'javascript:alert(1)', '///evil.test']) assert.equal(safeReturnPath(path, 'https://fixture.test'), '/');
  assert.equal(safeReturnPath('/?page=respond&call=42', 'https://fixture.test'), '/?page=respond&call=42');
  assert.equal(safeReturnPath('/inventory#checks', 'https://fixture.test'), '/inventory#checks');
});

test('preplan photos validate content signatures and reject active SVG or disguised HTML', async () => {
  assert.equal(await isSafePhoto(new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], { type: 'image/jpeg' })), true);
  assert.equal(await isSafePhoto(new Blob([new Uint8Array([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a])], { type: 'image/png' })), true);
  assert.equal(await isSafePhoto(new Blob(['RIFF0000WEBP'], { type: 'image/webp' })), true);
  for (const type of ['image/svg+xml', 'image/jpeg', 'image/png', 'image/webp', 'text/html']) assert.equal(await isSafePhoto(new Blob(['<svg onload="alert(1)"></svg>'], { type })), false);
  assert.equal(await isSafePhoto(new Blob([], { type: 'image/jpeg' })), false);
  let uploads = 0;
  const api = route('app/api/field-preplans/photos/route.ts', { isSafePhoto, ensureDatabase: async () => ({}), hasPermission: async () => true, getPortalStorage: () => ({ put: async () => { uploads++; } }) });
  const form = new FormData(); form.set('photo', new File(['<svg/>'], 'bad.svg', { type: 'image/svg+xml' }));
  const response = await api.POST(new Request('https://fixture.test/api/field-preplans/photos', { method: 'POST', headers: { 'oai-authenticated-user-email': 'fixture@example.test' }, body: form }));
  assert.equal(response.status, 400); assert.equal(uploads, 0);
});

test('attachment routes isolate legacy content and disable MIME sniffing', async () => {
  const config = route('next.config.ts').default;
  const rules = await config.headers();
  const attachment = rules.find(rule => rule.source.includes('field-preplans/photos'));
  for (const path of ['field-preplans/assets','safety-inspections/attachments','chief-board/attachments','employee-photo','digital-twin/media','operations/evidence','operations/documents']) assert.ok(attachment.source.includes(path));
  assert.ok(attachment.headers.some(header => header.key === 'Content-Security-Policy' && header.value.startsWith("sandbox; default-src 'none'")));
  assert.ok(attachment.headers.some(header => header.key === 'X-Content-Type-Options' && header.value === 'nosniff'));
});

test('department creation removes anonymous execution without removing owner access', () => {
  const source = fs.readFileSync(new URL('../supabase/migrations/20260918083545_restrict_department_creation_execution.sql', import.meta.url), 'utf8');
  assert.match(source, /REVOKE EXECUTE ON FUNCTION public\.create_department_with_admin\(text, text, text, text, text\) FROM PUBLIC, anon/);
  assert.match(source, /TO authenticated, service_role/);
});
