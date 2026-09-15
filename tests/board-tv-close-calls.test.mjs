import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const board = readFileSync('app/operations-board.tsx', 'utf8');
const selection = board.split('\n').find(line => line.includes('const displayedNews ='));
const slide = board.split('\n').find(line => line.includes('hidden={rotation !== "news"}'));
assert.ok(selection && slide);
// Exercise the actual selection and rendered slide, including real excerpts/empty state.
const compiled = ts.transpileModule(`
  export function CloseCalls({ tvMode, news, rotation = 'news' }) {
    ${selection}
    return (${slide});
  }
`, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
const exports = {};
new Function('require', 'exports', compiled)(createRequire(import.meta.url), exports);
const reports = Array.from({ length: 5 }, (_, index) => ({
  title: `Fictional report ${index + 1}`, url: `https://example.invalid/report-${index + 1}`,
  publishedAt: new Date(Date.UTC(2026, 8, 15 - index, 12)).toISOString(),
  excerpt: `Source description ${index + 1} — local test only.`,
}));
const render = (tvMode, news = reports, rotation = 'news') => renderToStaticMarkup(React.createElement(exports.CloseCalls, { tvMode, news, rotation }));

test('TV displays only the first two feed reports with their source descriptions', () => {
  const original = structuredClone(reports);
  const html = render(true);
  assert.equal((html.match(/<a /g) ?? []).length, 2);
  for (const report of reports.slice(0, 2)) {
    assert.ok(html.includes(report.title));
    assert.ok(html.includes(report.excerpt));
    assert.ok(html.includes(report.url));
  }
  for (const report of reports.slice(2)) assert.ok(!html.includes(report.title));
  assert.deepEqual(reports, original, 'TV selection must not mutate the shared feed');
});

test('regular portal retains every report and description', () => {
  const html = render(false);
  assert.equal((html.match(/<a /g) ?? []).length, reports.length);
  for (const report of reports) assert.ok(html.includes(report.excerpt));
});

test('TV handles single/empty feeds without invented descriptions', () => {
  const html = render(true, [{ ...reports[0], excerpt: '' }]);
  assert.equal((html.match(/<a /g) ?? []).length, 1);
  assert.doesNotMatch(html, /<p>/);
  assert.match(render(true, []), /Latest reports are temporarily unavailable/);
});

test('Close Calls remain mounted but hidden during other rotations', () => {
  assert.match(render(true, reports, 'nipsta'), /class="rotation-slide" hidden=""/);
});
