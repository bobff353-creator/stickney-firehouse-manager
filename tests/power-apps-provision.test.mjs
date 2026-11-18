import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function retiredHandler() {
  let handler;
  const code = ts.transpileModule(readFileSync(new URL('../power-apps/supabase/functions/provision-review-owner/index.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { exports: {}, Response,
    Deno: {
      env: { get: () => { throw Error('Retired setup must not access credentials'); } },
      serve: value => { handler = value; },
    },
    require: name => {
      assert.ok(name.startsWith('jsr:@supabase/functions-js/'), 'Retired setup must not load an administrative client');
      return {};
    },
    fetch: () => { throw Error('Retired setup must not make network requests'); },
  });
  return handler;
}

for (const scenario of [
  { name: 'anonymous callers', method: 'POST', headers: {} },
  { name: 'callers retaining the old server proof', method: 'POST', headers: { 'x-review-server-proof': 'a'.repeat(96), apikey: 'sb_publishable_fixture_only' } },
  { name: 'alternate request methods', method: 'GET', headers: {} },
]) {
  test('retired provisioning cannot issue credentials or change access for ' + scenario.name, async () => {
    const response = await retiredHandler()(new Request('https://review.fixture.test/provision', { method: scenario.method, headers: scenario.headers }));
    assert.equal(response.status, 410);
    assert.match(response.headers.get('cache-control'), /no-store/);
    const body = await response.json();
    assert.match(body.error, /setup is complete/);
    assert.equal('activationUrl' in body, false);
    assert.equal('userId' in body, false);
  });
}
