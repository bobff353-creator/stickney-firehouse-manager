import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../app/daily-log.tsx', import.meta.url), 'utf8');
const start = source.indexOf('const loadLog = useCallback(');
const end = source.indexOf('\n  }, []);', start) + '\n  }, []);'.length;
const compiled = ts.transpileModule(source.slice(start, end), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
function harness(fetch) {
  const state = {};
  const timers = [];
  const scope = { fetch, Error, Date, Map, Boolean, JSON, useCallback: fn => fn,
    loadRequest: { current: 0 }, loaded: { current: false }, autosaveAuthorized: { current: false },
    savedVersions: { current: new Map() }, draftKey: date => date,
    shiftSections: [], blankCall: () => ({ id: 'blank' }),
    window: { localStorage: { getItem: () => null }, setTimeout: fn => timers.push(fn) },
  };
  for (const name of source.slice(start, end).matchAll(/\b(set[A-Z]\w*)\(/g)) {
    scope[name[1]] = value => { state[name[1]] = value; };
  }
  const load = vm.runInNewContext(compiled + '\nloadLog', scope);
  return { load, state, scope, timers };
}
const ok = () => ({ ok: true, json: async () => ({ staffing: [], calls: [] }) });

test('failed load never enables editing or claims a verified saved date', async () => {
  const h = harness(async () => ({ ok: false, json: async () => ({ error: 'Unlock your PIN' }) }));
  await h.load('2026-09-07');
  assert.equal(h.state.setLoadError, true);
  assert.equal(h.state.setLoadedDate, null);
  assert.equal(h.state.setLastSynced, null);
  assert.equal(h.state.setMessage, 'Unlock your PIN');
  assert.equal(h.scope.autosaveAuthorized.current, false);
  assert.equal(h.scope.loaded.current, false);
  assert.equal(h.state.setStaffing, undefined);
});
test('retry recovers after a network failure', async () => {
  let fail = true;
  const h = harness(async () => { if (fail) throw new Error('Offline'); return ok(); });
  await h.load('2026-09-07');
  fail = false;
  await h.load('2026-09-07');
  h.timers.forEach(fn => fn());
  assert.equal(h.state.setLoadError, false);
  assert.equal(h.state.setLoadedDate, '2026-09-07');
  assert.equal(h.scope.loaded.current, true);
});
test('late response for a previous date cannot replace the selected log', async () => {
  let resolveOld;
  const h = harness(url => url.includes('09-07') ? new Promise(resolve => { resolveOld = resolve; }) : Promise.resolve(ok()));
  const old = h.load('2026-09-07');
  await h.load('2026-09-08');
  resolveOld(ok());
  await old;
  assert.equal(h.state.setLoadedDate, '2026-09-08');
});
test('load failure leaves an existing local draft untouched', async () => {
  const h = harness(async () => { throw new Error('Network'); });
  h.scope.window.localStorage.getItem = () => { throw new Error('Must not read protected drafts on failed access'); };
  await h.load('2026-09-07');
  assert.equal(h.state.setMessage, 'Network');
});
test('unverified date has no editable form and exposes recovery instead of Saved', () => {
  assert.match(source, /readOnly = loading \|\| loadError \|\| loadedDate !== logDate/);
  assert.match(source, /hidden=\{loadedDate !== logDate\}/);
  assert.match(source, /loadError \? "Not loaded"/);
  assert.match(source, /Retry loading log/);
  assert.match(source, /Unlock could not be confirmed/);
});
