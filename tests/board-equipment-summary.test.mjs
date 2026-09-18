import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const source = readFileSync('app/board-equipment-summary.tsx', 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
const exports = {};
new Function('require', 'exports', compiled)(createRequire(import.meta.url), exports);
const apparatus = [
  { unit: 'TEST-A', status: 'Available' }, { unit: 'TEST-B', status: 'Available' },
  { unit: 'TEST-C', status: 'Committed to call' }, { unit: 'TEST-D', status: 'Out of service' },
  { unit: 'TEST-E', status: 'Status not reported' },
];
const render = (props = {}) => renderToStaticMarkup(React.createElement(exports.BoardEquipmentSummary, {
  apparatus, confirmedAt: '2026-09-15T17:00:00Z', delayed: false, ...props,
}));

test('TV equipment reports do not duplicate the persistent apparatus status row', () => {
  const copy = structuredClone(apparatus), html = render();
  assert.match(html, /No equipment issues reported/);
  assert.doesNotMatch(html, /Fleet status summary|<dl|Unit TEST-|equipment-fleet-units/);
  assert.match(html, /Fleet availability is shown in Apparatus status below/);
  assert.match(html, /Confirmed/);
  assert.deepEqual(apparatus, copy);
});

test('missing equipment data cannot display a confirmed all-clear', () => {
  for (const props of [{ apparatus: undefined }, { confirmedAt: null }]) {
    const html = render(props);
    assert.match(html, /Equipment status not confirmed/);
    assert.doesNotMatch(html, /No equipment issues reported|Fleet status summary|✓/);
  }
  assert.match(render({ apparatus: [] }), /No equipment issues reported/);
  assert.doesNotMatch(render({ apparatus: [] }), /Fleet status summary/);
});

test('stale snapshot stays visibly delayed rather than presenting a fresh success', () => {
  const html = render({ delayed: true });
  assert.match(html, /Last report: no equipment issues/);
  assert.match(html, /Feed delayed/);
  assert.doesNotMatch(html, /✓/);
});

test('summary is TV-only, follows issue detection, and adds no requests or timers', () => {
  const board = readFileSync('app/operations-board.tsx', 'utf8');
  const equipment = board.split('\n').find(line => line.includes('hidden={rotation !== "equipment"}'));
  assert.match(equipment, /data\?\.equipmentIssues.length \? data.equipmentIssues.map/);
  assert.match(equipment, /: tvMode \|\| !data \? <BoardEquipmentSummary/);
  assert.match(equipment, /delayed=\{feedDegraded\}/);
  assert.doesNotMatch(source, /fetch\(|setInterval|setTimeout|useEffect/);
});
