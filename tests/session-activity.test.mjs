import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import vm from 'node:vm';
const source = readFileSync(new URL('../app/session-activity.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { latestSessionActivity, sessionIsIdle } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
const minute = 60_000;
test('background tab respects activity in another portal tab', () => {
  const latest = latestSessionActivity(1 * minute, String(29 * minute), 31 * minute);
  assert.equal(sessionIsIdle(latest, 31 * minute, 30 * minute), false);
});
test('background grace is 30 minutes, not immediate and not unlimited', () => {
  assert.equal(sessionIsIdle(minute, 30 * minute, 30 * minute), false);
  assert.equal(sessionIsIdle(minute, 31 * minute, 30 * minute), true);
});
test('invalid, future or older shared timestamps cannot extend activity', () => {
  for (const value of [null, '', 'NaN', '-1', String(100 * minute), String(minute)]) {
    assert.equal(latestSessionActivity(2 * minute, value, 3 * minute), 2 * minute);
  }
});
test('session lifecycle captures inner scrolling and flushes renewal on screen changes', () => {
  const component = readFileSync(new URL('../app/session-idle-lock.tsx', import.meta.url), 'utf8');
  assert.match(component, /passive: true, capture: true/);
  assert.match(component, /keepalive: true/);
  assert.match(component, /sessionIsIdle\(readActivity\(\), Date\.now\(\), inactivityLimitMs\)/);
  assert.match(component, /if \(!disposed && \(response\?\.status === 423/);
  assert.match(component, /inert=\{locked\}/);
  assert.match(component, /finally \{\s+setUnlocking\(false\)/);
});

function lifecycle() {
  const component = readFileSync(new URL('../app/session-idle-lock.tsx', import.meta.url), 'utf8');
  const start = component.lastIndexOf('useEffect(() => {', component.indexOf('if (locked) return;'));
  const end = component.indexOf('}, [locked, stationDisplay]);', start) + '}, [locked, stationDisplay]);'.length;
  const compiled = ts.transpileModule(component.slice(start, end), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  let now = minute;
  const storage = new Map(), events = new Map(), intervals = [], requests = [];
  let isLocked = false;
  const scope = { locked: false, stationDisplay: false, inactivityLimitMs: 30 * minute,
    unlockRefreshThrottleMs: minute, stationDisplayRefreshMs: 5 * minute,
    latestSessionActivity, sessionIsIdle, sessionActivityKey: 'activity',
    Date: { now: () => now }, Math, JSON, String,
    setLocked: value => { isLocked = value; }, setPin: () => {}, setMessage: () => {},
    fetch: async (url, options) => { requests.push(options.method); return { status: 200 }; },
    useEffect: fn => fn(),
    document: { visibilityState: 'visible', addEventListener: (name, fn) => events.set(name, fn), removeEventListener: () => {} },
    window: { localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
      addEventListener: (name, fn) => events.set(name, fn), removeEventListener: () => {},
      setTimeout: () => 1, clearTimeout: () => {}, setInterval: fn => { intervals.push(fn); return intervals.length; }, clearInterval: () => {},
    },
  };
  vm.runInNewContext(compiled, scope);
  return { events, requests, storage, tick: value => { now = value; intervals[0](); }, locked: () => isLocked };
}
test('actual idle effect does not delete shared cookie while another tab is active', async () => {
  const h = lifecycle();
  h.storage.set('activity', String(29 * minute));
  h.tick(31 * minute);
  assert.equal(h.locked(), false);
  assert.equal(h.requests.includes('DELETE'), false);
  h.tick(59 * minute);
  assert.equal(h.locked(), true);
  assert.equal(h.requests.includes('DELETE'), true);
});
test('actual visibility handler keeps a short background visit unlocked but not an expired one', async () => {
  const h = lifecycle();
  await new Promise(resolve => setImmediate(resolve));
  h.tick(20 * minute);
  h.events.get('visibilitychange')();
  assert.equal(h.locked(), false);
  assert.equal(h.requests.filter(method => method === 'PATCH').length, 2);
  h.tick(50 * minute);
  assert.equal(h.locked(), true);
});
