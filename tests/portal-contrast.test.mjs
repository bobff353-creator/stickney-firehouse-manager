import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import postcss from 'postcss';

const sheet = postcss.parse(readFileSync(new URL('../app/portal-contrast.css', import.meta.url), 'utf8'));
const inventorySheet = postcss.parse(readFileSync(new URL('../app/inventory/bento.css', import.meta.url), 'utf8'));
function luminance(hex) {
  const channels = hex.slice(1).match(/../g).map(value => parseInt(value, 16) / 255);
  return channels.map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4)
    .reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
}
function contrast(a, b) {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high + .05) / (low + .05);
}
function fullHex(value) {
  return /^#[a-f0-9]{3}$/i.test(value) ? '#' + value.slice(1).split('').map(c => c + c).join('') : value;
}

test('shared card, status, help and disabled palettes meet 4.5:1 for normal text', () => {
  let verified = 0;
  for (const stylesheet of [sheet, inventorySheet]) stylesheet.walkRules(rule => {
    const declarations = Object.fromEntries(rule.nodes.filter(node => node.type === 'decl').map(node => [node.prop, fullHex(node.value)]));
    const { color, background } = declarations;
    if (!/^#[a-f0-9]{6}$/i.test(color || '') || !/^#[a-f0-9]{6}$/i.test(background || '')) return;
    assert.ok(contrast(color, background) >= 4.5, `${rule.selector}: ${color} on ${background}`);
    verified++;
  });
  assert.ok(verified >= 15, 'Exercise neutral, selected, error, warning, saved and disabled surfaces.');
});

test('input boundaries meet 3:1 against both paper and dark field backgrounds', () => {
  const dark = '#0e1728', paper = '#ffffff';
  const fieldRules = [];
  sheet.walkRules(rule => { if (rule.selector.includes('input:not([type=checkbox])')) fieldRules.push(rule); });
  assert.equal(fieldRules.length, 2);
  for (const rule of fieldRules) {
    const border = rule.nodes.find(node => node.prop === 'border-color').value;
    assert.ok(contrast(border, rule.selector.includes('#portal-workspace') ? paper : dark) >= 3);
  }
});
