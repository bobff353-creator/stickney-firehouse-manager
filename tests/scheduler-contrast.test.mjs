import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import postcss from 'postcss';
import { calendarShiftText } from '../app/scheduler-calendar-view.ts';

const sheet = postcss.parse(readFileSync(new URL('../app/scheduler-workspace.css', import.meta.url), 'utf8'));
const fullHex = value => /^#[a-f\d]{3}$/i.test(value) ? '#' + value.slice(1).split('').map(c => c + c).join('') : value;
const luminance = hex => fullHex(hex).slice(1).match(/../g).map(v => parseInt(v, 16) / 255)
  .map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4)
  .reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
const contrast = (a, b) => (Math.max(luminance(a), luminance(b)) + .05) / (Math.min(luminance(a), luminance(b)) + .05);
function tokens(dark) {
  const result = {};
  sheet.walkDecls(/^--sf-/, declaration => {
    const inDark = declaration.parent.parent.type === 'atrule' && declaration.parent.parent.params.includes('prefers-color-scheme: dark');
    if (inDark && !dark) return;
    result[declaration.prop] = declaration.value;
  });
  return result;
}
const fallback = value => fullHex(value.replace(/^var\([^,]+,\s*(#[a-f\d]+)\)$/, '$1'));

test('scheduler light/dark text, disabled labels, boundaries and focus remain readable', () => {
  for (const dark of [false, true]) {
    const t = tokens(dark), surface = fallback(t['--sf-surface']), paper = fallback(t['--sf-paper']);
    const ink = fallback(t['--sf-ink']), muted = fallback(t['--sf-muted']);
    const disabledBg = t['--sf-disabled-bg'] || '#e5ebf1', disabledInk = t['--sf-disabled-ink'] || '#43566b';
    for (const back of [surface, paper]) {
      for (const front of [ink, muted]) assert.ok(contrast(front, back) >= 4.5, `${dark}: ${front} on ${back}`);
      assert.ok(contrast(t['--sf-line'], back) >= 3, 'Visible field and secondary-button boundaries');
      assert.ok(contrast(t['--sf-focus'] || '#965900', back) >= 3, 'Focus and selected indicator');
    }
    assert.ok(contrast(disabledInk, disabledBg) >= 4.5, 'Disabled labels stay readable without opacity fading');
    assert.ok(contrast('#ffffff', t['--sf-navy']) >= 4.5, 'Primary action text');
  }
});

test('all explicit scheduling status palettes and shift labels meet normal-text contrast', () => {
  let checked = 0;
  sheet.walkRules(rule => {
    const d = Object.fromEntries(rule.nodes.filter(n => n.type === 'decl').map(n => [n.prop, fullHex(n.value)]));
    if (!/^#[a-f\d]{6}$/i.test(d.color || '') || !/^#[a-f\d]{6}$/i.test(d.background || '')) return;
    assert.ok(contrast(d.color, d.background) >= 4.5, `${rule.selector}: ${d.color} on ${d.background}`);
    checked++;
  });
  assert.equal(checked, 9, 'Exercise every explicit success, warning, error and destructive-action palette');
  for (const color of ['#ef3340', '#2d3744', '#f0a51a', '#3182bd', '#22a55b', '#805ad5', '#ed8936']) {
    assert.ok(contrast(calendarShiftText(color), color) >= 4.5, `Shift label ${color}`);
  }
});
