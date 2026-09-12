import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import postcss from 'postcss';

const css = postcss.parse(readFileSync(new URL('../app/portal-usability.css', import.meta.url), 'utf8'));
test('shared portal styling does not reset a focused preplan to one column', () => {
  let directoryRule = false;
  css.walkRules(rule => {
    rule.walkDecls('grid-template-columns', declaration => {
      if (!rule.selector.includes('.field-preplans-page')) return;
      assert.ok(rule.selector.includes('.field-preplans-page:not(.preplan-builder-focused)'));
      assert.equal(declaration.value, 'minmax(0, 1fr)');
      directoryRule = true;
    });
  });
  assert.ok(directoryRule);
});

test('map has an explicit first column and editor headings cannot float over fields', () => {
  let firstColumn = false, staticHeader = false;
  css.walkRules(rule => {
    if (rule.selector === '.preplan-focus-map-panel') rule.walkDecls('grid-column', d => { firstColumn = d.value === '1'; });
    if (rule.selector === '.preplan-builder-focused > .preplan-editor > header') {
      rule.walkDecls('position', d => { staticHeader = d.value === 'static'; });
    }
  });
  assert.ok(firstColumn && staticHeader);
});

test('drawing hides only presentation overlays and restores saved context outside footprint mode', () => {
  const source = readFileSync(new URL('../app/field-preplans.tsx', import.meta.url), 'utf8');
  assert.match(source, /const capturingFootprint=recordMode==="edit"&&mode==="footprint"/);
  assert.match(source, /plans=\{capturingFootprint\?\[\]:mapPlans\} hydrants=\{capturingFootprint\?\[\]:hydrants\}/);
  assert.match(source, /temporarily hidden; they return after you accept the footprint/);
  assert.match(source, /className="preplan-map-zoom" role="group" aria-label="Map zoom"/);
});
