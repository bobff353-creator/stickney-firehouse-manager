import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync('app/respond.tsx', 'utf8');
const css = readFileSync('app/globals.css', 'utf8');
const active = source.slice(source.indexOf('className={`respond-page respond-active-call'));

test('active Respond removes duplicate shortcuts and routine status but retains real error alerts', () => {
  assert.doesNotMatch(source, /className="respond-jump-actions"|function openTacticalView/);
  assert.doesNotMatch(active, /className="respond-statusline"/);
  assert.match(active, /error && <p className="respond-update-warning" role="alert">\{error\}/);
  assert.match(active, /role="tablist" aria-label="Response tactical views"/);
  assert.match(active, /respond-offline-banner/);
});

test('field controls take no empty space unless a call is scoped to an apparatus', () => {
  assert.match(active, /progressScope && <section className="respond-field-toolbar"/);
  assert.match(active, /Saved for this unit and call on this browser only/);
});

test('box card keeps its title and number with a clear path to full instructions', () => {
  const box = active.slice(active.indexOf('<article className="respond-box-card">'), active.indexOf('<article className="respond-nearest-hydrants">'));
  assert.match(box, /data\?\.boxCard\?\.title/);
  assert.match(box, /data.boxCard.boxNumber/);
  assert.match(box, /Full instructions in box cards/);
  assert.match(box, /onNavigate\?\.\("Box Cards"\)/);
  assert.doesNotMatch(box, /accessNotes/);
});

test('Monitor View uses scrollable content flow instead of clipping a fixed number of rows', () => {
  assert.match(css, /\.respond-active-call\.monitor-view\{[^}]*display:flex;flex-direction:column;[^}]*height:100dvh;overflow-y:auto/);
  assert.match(css, /\.respond-active-call\.monitor-view>\*\{flex-shrink:0\}/);
  assert.match(css, /\.respond-active-call\.monitor-view>\.respond-grid\{[^}]*min-height:280px;overflow:visible/);
  assert.match(css, /\.respond-active-call\.monitor-view \.respond-primary-media img\{[^}]*object-fit:contain/);
  assert.match(css, /@media\(max-height:500px\)\{\.respond-active-call\.monitor-view>\.respond-callbar\{position:static\}/);
});

test('compact summaries wrap instead of truncating locations or hiding hydrants', () => {
  assert.match(css, /\.respond-active-call \.respond-glance>article\{[^}]*min-height:0/);
  assert.match(css, /\.respond-active-call \.respond-glance>article>button\{min-height:44px/);
  assert.match(active, /data.nearestHydrants.map/);
  assert.doesNotMatch(css.slice(css.indexOf('/* Active-call layout:')), /line-clamp|text-overflow:ellipsis/);
});

test('tablet summaries stack before their location columns become too narrow', () => {
  assert.match(css, /@media\(max-width:1100px\)\{\s*\.respond-active-call \.respond-glance\{grid-template-columns:minmax\(0,1fr\)\}/);
  assert.match(css, /\.respond-active-call \.respond-call-actions>\.respond-nav\{grid-column:auto;grid-row:auto\}/);
});

test('illustrated photos keep their intrinsic aspect ratio inside the monitor image panel', () => {
  assert.match(css, /\.respond-active-call\.monitor-view \.respond-primary-media\{[^}]*overflow:auto;container-type:size/);
  assert.match(css, /\.respond-primary-media \.photo-illustration-stage img\{width:auto!important;height:auto!important;max-width:100%;max-height:calc\(100cqh - 28px\)!important/);
  assert.match(css, /\.respond-active-call \.respond-context-body\{max-height:min\(60dvh,600px\);overflow:auto\}/);
});
