import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

function compileInventory(dependencies) {
  const source = fs.readFileSync(new URL('../app/lib/supabase-server.ts', import.meta.url), 'utf8');
  const compiled = { exports: {} };
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function('require', 'module', 'exports', output)((name) => {
    assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
    return dependencies[name];
  }, compiled, compiled.exports);
  return compiled.exports.createInventorySupabaseClient;
}

function fixture({ cookieWritesFail = false, securityError = false } = {}) {
  let config = { url: 'https://source-fixture.invalid', key: 'publishable-source-fixture' };
  const calls = [];
  const writes = [];
  const existingCookies = [{ name: 'session-fixture', value: 'fixture-only' }];
  const create = compileInventory({
    '@supabase/ssr': { createServerClient(url, key, options) {
      const client = { url, key, options };
      calls.push(client);
      return client;
    } },
    'next/headers': { async cookies() { return {
      getAll: () => existingCookies,
      set(...args) {
        if (cookieWritesFail) throw new Error('Read-only Server Component cookies');
        writes.push(args);
      },
    }; } },
    '../supabase-config': { getPublicSupabaseConfig: () => config },
    '../portal-server-headers': { portalServerHeaders() {
      if (securityError) throw new Error('Portal database security is not configured.');
      return { 'x-firehouse-server-key': 'server-proof-fixture-only' };
    } },
  });
  return { create, calls, writes, existingCookies, setConfig(value) { config = value; } };
}

test('Inventory follows the shared project configuration on every request', async () => {
  const f = fixture();
  const source = await f.create();
  f.setConfig({ url: 'https://target-fixture.invalid', key: 'publishable-target-fixture' });
  const target = await f.create();
  assert.equal(source.url, 'https://source-fixture.invalid');
  assert.equal(target.url, 'https://target-fixture.invalid');
  assert.equal(target.key, 'publishable-target-fixture');
  assert.equal(f.calls.length, 2);
  assert.notEqual(source, target, 'Do not reuse a user-scoped server client');
});

test('the shared project still requires the server proof and forwards session cookies', async () => {
  const f = fixture();
  const client = await f.create();
  assert.equal(client.options.global.headers['x-firehouse-server-key'], 'server-proof-fixture-only');
  assert.deepEqual(client.options.cookies.getAll(), f.existingCookies);
  const options = { httpOnly: true, secure: true, path: '/' };
  client.options.cookies.setAll([{ name: 'refreshed-fixture', value: 'fixture-new', options }]);
  assert.deepEqual(f.writes, [['refreshed-fixture', 'fixture-new', options]]);
});

test('Inventory cannot initialize without its server security configuration', async () => {
  const f = fixture({ securityError: true });
  await assert.rejects(f.create(), /security is not configured/);
  assert.equal(f.calls.length, 0);
});

test('read-only Server Component cookies retain the existing proxy-refresh behavior', async () => {
  const f = fixture({ cookieWritesFail: true });
  const client = await f.create();
  assert.doesNotThrow(() => client.options.cookies.setAll([
    { name: 'refreshed-fixture', value: 'fixture-new', options: { httpOnly: true } },
  ]));
});
