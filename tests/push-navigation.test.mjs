import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const origin = 'https://fixture.invalid';
const worker = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
function fixture(windows = [], failLookup = false) {
  const handlers = new Map(), opened = [];
  let closed = false;
  vm.runInNewContext(worker, { URL, console, self: {
    location: { origin }, addEventListener: (name, fn) => handlers.set(name, fn),
    clients: {
      async matchAll() { if (failLookup) throw Error('No clients'); return windows; },
      async openWindow(url) { opened.push(url); },
    },
  } });
  return { opened, async tap(data) {
    let pending;
    handlers.get('notificationclick')({ notification: { data, close() { closed = true; } }, waitUntil(value) { pending = value; } });
    await pending;
    assert.equal(closed, true);
  } };
}

test('new CAD payload targets the call parameter actually consumed by Respond', () => {
  const compiled = { exports: {} };
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../app/cad-push.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { module: compiled, exports: compiled.exports, require: () => ({}) });
  const payload = compiled.exports.buildCadPushPayload({ incidentId: '26 / A&1', callType: 'TEST', timeOut: '0830', narrative: '' });
  const target = new URL(payload.url, origin);
  assert.equal(target.searchParams.get('report'), '26 / A&1');
  assert.equal(target.searchParams.get('display'), 'portal');
  assert.equal(target.searchParams.has('call'), false);
});

test('old queued CAD links open the selected call and override remembered TV display', async () => {
  const f = fixture();
  await f.tap({ url: '/?page=respond&call=26%2F123', kind: 'cad' });
  const target = new URL(f.opened[0]);
  assert.equal(target.searchParams.get('report'), '26/123');
  assert.equal(target.searchParams.get('display'), 'portal');
  assert.equal(target.searchParams.has('call'), false);
});

test('schedule and other module notifications retain their own destinations', async () => {
  for (const data of [
    { kind: 'scheduler' },
    { kind: 'scheduler', url: '/?page=scheduling&adminTask=calendar' },
    { kind: 'inspection', url: '/?page=safety-inspections&record=fixture' },
  ]) {
    const f = fixture(); await f.tap(data);
    const target = new URL(f.opened[0]);
    assert.equal(target.searchParams.get('page'), data.kind === 'scheduler' ? 'scheduling' : 'safety-inspections');
    assert.equal(target.searchParams.get('display'), 'portal');
    if (data.kind === 'inspection') assert.equal(target.searchParams.get('record'), 'fixture');
  }
});

test('TV boards and unrelated employee forms are left in place', async () => {
  const windows = ['/?page=respond&display=tv', '/?page=employees&display=portal'].map(path => ({
    url: origin + path, async navigate() { assert.fail('Must not navigate unrelated screens'); },
    async focus() { assert.fail('Must open the requested screen'); },
  }));
  const f = fixture(windows); await f.tap({ url: '/?page=respond&report=fixture' });
  assert.equal(new URL(f.opened[0]).searchParams.get('report'), 'fixture');
});

test('an existing target screen is navigated then focused; exact targets need no reload', async () => {
  const destination = origin + '/?page=respond&display=portal&report=fixture';
  for (const exact of [false, true]) {
    const actions = [];
    const window = { url: exact ? destination : origin + '/?page=respond&display=portal',
      async navigate(url) { actions.push(url); return { async focus() { actions.push('focus navigated client'); } }; },
      async focus() { actions.push('focus existing client'); },
    };
    const f = fixture([window]); await f.tap({ url: destination });
    assert.deepEqual(actions, exact ? ['focus existing client'] : [destination, 'focus navigated client']);
    assert.equal(f.opened.length, 0);
  }
});

test('failed or unavailable navigation and lookup still open a correct destination', async () => {
  for (const navigate of [async () => null, async () => { throw Error('Window closed'); }, undefined]) {
    const f = fixture([{ url: origin + '/?page=scheduling&display=portal', navigate }]);
    await f.tap({ kind: 'scheduler', url: '/?page=scheduling&adminTask=calendar' });
    assert.equal(new URL(f.opened[0]).searchParams.get('adminTask'), 'calendar');
  }
  const f = fixture([], true); await f.tap({ kind: 'scheduler' });
  assert.equal(new URL(f.opened[0]).searchParams.get('page'), 'scheduling');
});

test('untrusted destinations fall back inside the portal and test alerts do not select fake incidents', async () => {
  for (const url of ['https://other.invalid/?page=respond', 'javascript:alert(1)', 'http://[bad']) {
    const f = fixture(); await f.tap({ url, kind: 'scheduler' });
    assert.equal(f.opened[0], origin + '/?page=scheduling&display=portal');
  }
  const f = fixture(); await f.tap({ url: '/?page=respond&report=TEST', incidentId: 'TEST' });
  assert.equal(new URL(f.opened[0]).searchParams.has('report'), false);
});
