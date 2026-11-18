import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import ts from 'typescript';

function fixture({ proofValid = true, project = 'qizfnynrspsydiuwkkex', membershipFails = false } = {}) {
  let handler; const calls = [];
  const user = { id: 'ed192761-2ecd-4ecc-a1e8-39ceb39f0145', email: 'bwyant@stickneyfire.com' };
  const admin = {
    rpc: async (_name, args) => { calls.push(['proof', args]); return proofValid ? { data: { operation: 'review-owner-bootstrap' } } : { error: { code: '42501' } }; },
    from: table => ({ select: () => ({ eq: () => ({ single: async () => ({ data: { id: 'verified-department' } }) }) }),
      upsert: async value => { calls.push([table, value]); return membershipFails ? { error: { code: 'unavailable' } } : {}; } }),
    auth: { admin: {
      getUserById: async () => ({ data: { user: null } }),
      createUser: async value => { calls.push(['identity', { id: value.id, email: value.email }]); assert.ok(value.password.length >= 64); return { data: { user } }; },
      generateLink: async value => { calls.push(['link', value]); return { data: { user, properties: { hashed_token: 'fixture-one-time-token' } } }; },
    } },
  };
  const code = ts.transpileModule(readFileSync(new URL('../power-apps/supabase/functions/provision-review-owner/index.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { exports: {}, Response, URL, crypto: webcrypto,
    Deno: { env: { get: name => name === 'SUPABASE_URL' ? `https://${project}.supabase.co` : 'fixture-service-key' }, serve: value => { handler = value; } },
    require: name => name.startsWith('jsr:') ? {} : { createClient: () => { calls.push(['client']); return admin; } },
  });
  return { handler, calls };
}
const request = proof => new Request('https://review.fixture.test/provision', { method: 'POST', headers: { apikey: 'sb_publishable_fixture_only', ...(proof ? { 'x-review-server-proof': proof } : {}) }, body: JSON.stringify({ email: 'attacker@example.test', role: 'owner', departmentId: 'unrelated' }) });

test('provisioning rejects missing and incorrect server proofs before issuing credentials', async () => {
  const missing = fixture(); assert.equal((await missing.handler(request())).status, 401); assert.equal(missing.calls.length, 0);
  const wrong = fixture({ proofValid: false }); assert.equal((await wrong.handler(request('a'.repeat(96)))).status, 401);
  assert.equal(wrong.calls.some(([name]) => name === 'identity' || name === 'link'), false);
  const source = fixture({ project: 'datqzdndkrfyovhwppuq' }); assert.equal((await source.handler(request('a'.repeat(96)))).status, 503); assert.equal(source.calls.length, 0);
});

test('provisioning retains the verified existing ID and cannot accept a caller-selected account or role', async () => {
  const f = fixture(); const response = await f.handler(request('a'.repeat(96))); assert.equal(response.status, 200);
  assert.deepEqual(JSON.parse(JSON.stringify(f.calls.find(([name]) => name === 'identity')[1])), { id: 'ed192761-2ecd-4ecc-a1e8-39ceb39f0145', email: 'bwyant@stickneyfire.com' });
  const membership = f.calls.find(([name]) => name === 'department_memberships')[1];
  assert.equal(membership.department_id, 'verified-department'); assert.equal(membership.role, 'admin');
  const activation = new URL((await response.json()).activationUrl);
  assert.equal(activation.origin, 'https://stickney-power-apps-review.vercel.app');
  assert.equal(activation.searchParams.get('type'), 'magiclink');
});

test('a membership failure never returns an activation credential', async () => {
  const f = fixture({ membershipFails: true }); const response = await f.handler(request('a'.repeat(96)));
  assert.equal(response.status, 503); assert.equal('activationUrl' in await response.json(), false);
});
