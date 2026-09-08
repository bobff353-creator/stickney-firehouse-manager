import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const css = readFileSync(new URL('../app/mobile-usability.css', import.meta.url), 'utf8');
test('scrollable callback roster uses content-sized rows rather than squeezing warnings', () => {
  const rule = css.match(/\.callback-panel \.callback-employee-list \{([^}]+)\}/)[1];
  assert.match(rule, /grid-auto-rows: max-content/);
  assert.match(rule, /align-content: start/);
  assert.match(rule, /overflow-y: auto/);
  assert.match(css, /label > span \{[^}]*flex-direction: column[^}]*overflow-wrap: anywhere/);
});
