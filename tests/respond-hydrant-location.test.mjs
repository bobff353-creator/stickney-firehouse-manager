import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

// Render the actual Respond card, not a separately maintained copy of its labels.
const source = await readFile(new URL('../app/respond.tsx', import.meta.url), 'utf8');
const start = source.indexOf('<article className="respond-nearest-hydrants">');
assert.ok(start >= 0);
const card = source.slice(start, source.indexOf('</article>', start) + '</article>'.length);
const compiled = ts.transpileModule(`export function Card({data,onNavigate}) { return (${card}); }`, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
}).outputText;
const exports = {};
new Function('require', 'exports', compiled)(createRequire(import.meta.url), exports);
const hydrant = { id: 'fixture', address: 'Preview address', hydrantNumber: '106', distanceFeet: 126, serviceStatus: 'in_service' };
const render = rows => renderToStaticMarkup(React.createElement(exports.Card, { data: { nearestHydrants: rows } }));

test('nearest hydrants show saved location first with number, distance and status secondary', () => {
  const html = render([{ ...hydrant, address: '  Preview Oak Avenue at Sample Street  ' }]);
  assert.match(html, /<b>Preview Oak Avenue at Sample Street<\/b>/);
  assert.match(html, /<small>Hydrant 106 · 126 ft · in service<\/small>/);
  assert.doesNotMatch(html, /<b>106<\/b>/);
});

test('missing and blank addresses are explicitly unrecorded, not guessed from an ID', () => {
  for (const address of ['', '   ', null, undefined]) {
    const html = render([{ ...hydrant, address, serviceStatus: 'out_of_service' }]);
    assert.match(html, /<b>Location not recorded<\/b>/);
    assert.match(html, /Hydrant 106 · 126 ft · out of service/);
  }
});

test('an unnumbered hydrant keeps location, distance and status without an empty ID label', () => {
  for (const hydrantNumber of ['', '   ', null, undefined]) {
    const html = render([{ ...hydrant, hydrantNumber, distanceFeet: 1256, serviceStatus: 'unknown' }]);
    assert.match(html, /<b>Preview address<\/b>/);
    assert.match(html, /<small>1,256 ft · unknown<\/small>/);
  }
});

test('saved location text is escaped, response ordering and empty state are preserved', () => {
  const html = render([{ ...hydrant, address: '<script>not executable</script>' }, { ...hydrant, id: 'second', address: 'Second location' }]);
  assert.match(html, /&lt;script&gt;not executable&lt;\/script&gt;/);
  assert.ok(html.indexOf('not executable') < html.indexOf('Second location'));
  assert.match(render([]), /No verified hydrants are mapped near this incident/);
  assert.match(render([]), /Open preplans &amp; hydrants/);
});
