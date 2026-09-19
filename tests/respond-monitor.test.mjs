import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const respond = readFileSync('app/respond.tsx', 'utf8');
const exit = readFileSync('app/respond-monitor-exit.tsx', 'utf8');
const css = readFileSync('app/respond-monitor.css', 'utf8');

test('full-screen control is available in loading, error, map, and active-call views', () => {
  assert.equal((respond.match(/\{monitorExit\}/g) ?? []).length, 4);
  assert.match(respond, /monitorMode \? <RespondMonitorExit/);
  assert.match(exit, /aria-label="Exit full-screen Respond"/);
  assert.match(exit, /onClick=\{onExit\}/);
  assert.match(respond, /document\.exitFullscreen\(\)/);
  assert.match(respond, /event\.key === "Escape" && !document\.fullscreenElement/);
});

test('exit reuses the tested three-second timer with mouse, touch, and keyboard cleanup', () => {
  assert.match(exit, /createTvExitVisibility/);
  for (const event of ['pointermove', 'pointerdown', 'keydown']) {
    assert.ok(exit.includes(`addEventListener("${event}", reveal`));
    assert.ok(exit.includes(`removeEventListener("${event}", reveal`));
  }
  assert.match(exit, /visibility\.dispose\(\)/);
  assert.match(css, /opacity: 0;\s*pointer-events: none/);
  assert.match(css, /:focus-visible \{ opacity: 1; pointer-events: auto/);
  assert.doesNotMatch(exit, /aria-hidden=\{!visible\}|tabIndex=\{-1\}|fetch\(/);
});

test('only full-screen hides location management and the map title; live hooks stay mounted', () => {
  assert.match(css, /\.respond-page\.monitor-view \.apparatus-location-panel,/);
  assert.match(css, /\.respond-overview-page\.monitor-view > \.respond-title,/);
  assert.match(respond, /const locations=useApparatusLocations\(Boolean\(apparatus\)\|\|monitorMode/);
  assert.match(respond, /<RespondOverviewMap\s+locationModel=\{locations\}/);
  assert.doesNotMatch(css, /(?:^|\})\s*\.apparatus-location-panel\s*\{/);
});

test('routine context disappears but stale-data warning and retry remain visible', () => {
  assert.match(css, /\.respond-context-line:not\(\.stale\) \{ display: none/);
  assert.match(css, /\.respond-context-line\.stale > :not\(\.respond-context-freshness\):not\(button\)/);
  assert.match(respond, /className="respond-context-freshness">\{freshness.label\}/);
  assert.match(respond, /freshness.warning && <button[^]*?Retry updates/);
});

test('GPS pairing, displayed vehicles, and CAD call filtering are explicitly distinguished', () => {
  const panel = readFileSync('app/apparatus-locations-panel.tsx', 'utf8');
  assert.match(panel, /Show on map<select/);
  assert.match(panel, /GPS sharing only/);
  assert.match(panel, /does not choose which CAD calls Respond receives/);
  assert.match(panel, /Respond Device Modes → Apparatus Respond → Assigned apparatus/);
});

test('monitor hides secondary sections without removing saved records from normal Respond', () => {
  for (const section of ['respond-attachments', 'respond-hose-lays', 'respond-level-switcher', 'apparatus-map-only']) {
    assert.ok(css.includes(`.respond-page.respond-active-call.monitor-view > .${section}`));
    assert.ok(respond.includes(`className="${section}"`));
  }
  assert.match(respond, /aria-label="Monitor preplan level"/);
  assert.match(respond, /monitorMode && \(data\?\.operational\?\.levels.length \?\? 0\) > 1/);
  assert.match(respond, /status === "on_scene" && !monitorMode/);
});

test('apparatus map is a keyboard-accessible tactical tab sharing the current location model', () => {
  assert.match(respond, /"D",\s*"apparatus",/);
  assert.match(respond, /item === "apparatus" \? "Apparatus"/);
  assert.match(respond, /view === "apparatus" && <RespondOverviewMap locationModel=\{locations\} apparatusOnly respondingUnits=\{call.respondingUnits\}/);
  assert.match(respond, /onKeyDown=\{\(event\) => moveContextTab\(event, item\)\}/);
  assert.match(css, /\.respond-context > nav:has\(#respond-tab-apparatus\)/);
});

test('monitor building facts stay readable in a compact two-row grid', () => {
  assert.match(css, /\.respond-quick-building h2 \{[^}]*font-size: 11px; line-height: 14px/);
  assert.match(css, /\.respond-quick-building dl \{[^}]*grid-template-columns: repeat\(5, minmax\(0, 1fr\)\)/);
  assert.match(css, /\.respond-quick-building dd \{[^}]*font-size: 12px/);
  assert.match(css, /\.respond-operational-banner \{[^}]*overflow: auto/);
  assert.doesNotMatch(css, /\.respond-operational-banner[^{}]*\{[^}]*text-overflow|line-clamp/);
});

test('compact monitor keeps its assigned unit visible and preserves touch targets', () => {
  assert.match(respond, /monitorMode && apparatus \? ` · UNIT \$\{apparatus\}`/);
  assert.match(css, /\.respond-callbar dl \{ grid-column: auto; grid-row: auto/);
  assert.match(css, /@media \(pointer: coarse\)[^]*?min-height: 44px/);
});
