import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const source = readFileSync('app/board-fatalities.tsx', 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
const require = createRequire(import.meta.url), exported = {};
new Function('require', 'exports', compiled)(require, exported);
const reports = Array.from({ length: 5 }, (_, index) => ({
  id: index + 1, name: `Fictional firefighter ${index + 1}`, department: `Preview department ${index + 1}`,
  location: 'Fictional city, IL', deathDate: '2026-10-20T00:00:00', url: `https://example.invalid/report-${index + 1}`,
}));
const data = { year: 2026, total: 76, items: reports };
const render = (overrides = {}) => renderToStaticMarkup(React.createElement(exported.default, {
  data, tvMode: false, active: true, updatedLabel: 'Saved fictional update', ...overrides,
}));

test('portal shows every saved name, department, city/state, date and original report link', () => {
  const before = structuredClone(data), html = render();
  for (const person of reports) for (const field of ['name', 'department', 'location', 'url']) assert.ok(html.includes(person[field]));
  assert.match(html, />76<\/strong>/);
  assert.match(html, /Recent reports 1–5 of 5/);
  assert.match(html, /dateTime="2026-10-20T00:00:00"/);
  assert.deepEqual(data, before);
});

test('short TV pages preserve every report and rotate without changing source order or data', () => {
  const before = structuredClone(reports);
  const seen = [];
  for (let index = 0; index < reports.length; index++) {
    const page = exported.fatalityPage(reports, 106, index);
    assert.equal(page.items.length, 1);
    seen.push(...page.items.map(person => person.id));
  }
  assert.deepEqual(seen, reports.map(person => person.id));
  assert.deepEqual(reports, before);
  const html = render({ tvMode: true });
  for (const field of ['name', 'department', 'location']) assert.ok(html.includes(reports[0][field]));
  assert.match(html, /More reports rotate automatically/);
  assert.ok(!html.includes(reports[1].name));
});

test('larger TV pages use available height and retain the final partial page', () => {
  assert.deepEqual(exported.fatalityPage(reports, 336, 0).items, reports.slice(0, 3));
  assert.deepEqual(exported.fatalityPage(reports, 336, 1).items, reports.slice(3));
  assert.deepEqual(exported.fatalityPage(reports, 600, 0).items, reports);
  assert.deepEqual(exported.fatalityPage([], 0, 1).items, []);
});

test('a count-only update explains missing details and links to the official source', () => {
  const html = render({ data: { ...data, items: [] } });
  assert.match(html, />76<\/strong>/);
  assert.match(html, /Recent names and departments are not available in this saved update/);
  assert.match(html, /href="https:\/\/apps.usfa.fema.gov\/firefighter-fatalities\/"/);
  assert.doesNotMatch(html, /Fictional firefighter|undefined|NaN/);
  assert.match(render({ data: null }), /temporarily unavailable/);
});

test('missing source fields are labeled honestly without inventing names or locations', () => {
  const html = render({ data: { ...data, items: [{ ...reports[0], name: '', department: '', location: '', deathDate: '' }] } });
  for (const label of ['Name not provided by USFA', 'Department not provided by USFA', 'Location not provided by USFA', 'Date unavailable']) assert.ok(html.includes(label));
  assert.doesNotMatch(html, /Invalid Date|undefined|NaN/);
});
