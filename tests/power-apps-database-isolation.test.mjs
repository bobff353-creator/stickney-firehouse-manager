import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../app/supabase-config.ts', import.meta.url), 'utf8');
function configuration(env) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText, { exports, process: { env }, URL });
  return exports.getPublicSupabaseConfig();
}

test('standalone review has no inherited project or key fallback', () => {
  for (const env of [
    {},
    { NEXT_PUBLIC_SUPABASE_URL: 'https://independent-fixture.supabase.co' },
    { NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'fixture-only-key' },
  ]) assert.throws(() => configuration(env), /not configured/);
});

for (const host of [
  'ukpdacqjmhvlhmrwxtcx.supabase.co',
  'datqzdndkrfyovhwppuq.supabase.co',
]) {
  test(`standalone review rejects the known operational project ${host}`, () => {
    for (const hostname of [host, host.toUpperCase(), `${host}.`, `db.${host}`]) {
      assert.throws(() => configuration({
        NEXT_PUBLIC_SUPABASE_URL: `https://${hostname}`,
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'fixture-only-key',
      }), /independent Supabase project/);
    }
  });
}

test('an explicitly configured independent project retains publishable-key precedence', () => {
  const result = configuration({
    NEXT_PUBLIC_SUPABASE_URL: '\uFEFF https://independent-fixture.supabase.co\r\n',
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: ' fixture-publishable\n',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'fixture-anon',
  });
  assert.equal(result.url, 'https://independent-fixture.supabase.co');
  assert.equal(result.key, 'fixture-publishable');
});

test('explicit local standalone configuration remains available for isolated testing', () => {
  const result = configuration({
    NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'fixture-only-anon',
  });
  assert.equal(result.url, 'http://127.0.0.1:54321');
  assert.equal(result.key, 'fixture-only-anon');
});
