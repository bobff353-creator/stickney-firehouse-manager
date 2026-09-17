import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
const require = createRequire(import.meta.url);
function load(path) {
  const file = resolve(path);
  const target = { exports: {} };
  const code = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  new Function('require', 'module', 'exports', code)(id => id.endsWith('.css') ? new Proxy({}, { get: (_, key) => String(key) }) : id.startsWith('.') ? load(resolve(dirname(file), existsSync(resolve(dirname(file), id + '.ts')) ? id + '.ts' : id + '.tsx')) : require(id), target, target.exports);
  return target.exports;
}
// Render the actual React components. This verifies markup, not visual layout.
const BoardCalls = load('app/board-active-calls.tsx').default;
const Routing = load('app/cis-routing-settings.tsx').default;
const calls = [1,2,3].map(n => ({ reportNumber: `FIXTURE-${n}`, callType: `Fixture type ${n}`, address: `Fixture address ${n}`, respondingUnits: '1204', timeOut: '0900' }));
test('board offers all department calls; TV rotates all calls without edit controls', () => {
  const desktop = renderToStaticMarkup(React.createElement(BoardCalls, { calls, tvMode: false, now: 0 }));
  assert.equal((desktop.match(/<option/g) || []).length, 3);
  assert.match(desktop, /Select department call/); assert.match(desktop, /report=FIXTURE-1/);
  for (let index = 0; index < 3; index++) {
    const tv = renderToStaticMarkup(React.createElement(BoardCalls, { calls, tvMode: true, now: index * 12000 }));
    assert.match(tv, new RegExp(`Active call ${index + 1} of 3`));
    assert.match(tv, new RegExp(`Fixture type ${index + 1}`));
    assert.doesNotMatch(tv, /<select|<a /);
  }
});
test('routing settings are disabled by default and live mode requires explicit acknowledgment', () => {
  const props = { saved: { revision: '', mode: 'disabled', agencies: [], units: [] }, fleet: [], secretConfigured: false, onSaved() {} };
  const html = renderToStaticMarkup(React.createElement(Routing, props));
  assert.match(html, /value="disabled" selected=""/);
  assert.match(html, /<option value="live" disabled=""/);
  assert.match(html, /no live calls or notifications/);
  assert.doesNotMatch(html, /fixture-only|sb_secret|Bearer/);
  const live = renderToStaticMarkup(React.createElement(Routing, { ...props, saved: { ...props.saved, mode: 'live' }, secretConfigured: true }));
  assert.match(live, /type="checkbox"/);
  assert.match(live, /disabled="">Save routing settings/);
});
