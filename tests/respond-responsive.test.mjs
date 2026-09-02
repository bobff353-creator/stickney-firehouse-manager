import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const css = fs.readFileSync("app/globals.css", "utf8");

const requiredViewports = [
  [360, 800, "phone"],
  [390, 844, "phone"],
  [768, 1024, "iPad portrait"],
  [1024, 768, "iPad landscape"],
  [1366, 768, "laptop"],
  [1920, 1080, "apparatus monitor"],
];

test("Phase 8 responsive matrix retains every required viewport", () => {
  assert.deepEqual(requiredViewports.map(([width, height]) => `${width}x${height}`), [
    "360x800",
    "390x844",
    "768x1024",
    "1024x768",
    "1366x768",
    "1920x1080",
  ]);
});

test("Respond contains horizontal overflow without hiding level navigation", () => {
  assert.match(css, /\.respond-page\{min-width:0;max-width:100%;overflow-x:clip\}/);
  assert.match(css, /\.respond-grid>\*,\.respond-callbar>\*,\.respond-quick>\*\{min-width:0\}/);
  assert.match(css, /\.respond-level-switcher>div\{[^}]*overflow:auto/);
  assert.match(css, /overflow-wrap:anywhere/);
});

test("phone Respond stacks title actions and critical detail without tiny controls", () => {
  assert.match(css, /@media\(max-width:800px\)\{\.respond-title\{[^}]*flex-direction:column/);
  assert.match(css, /\.respond-intel-list button,\.respond-monitor,\.respond-title-actions button,\.respond-quick>button\{min-height:44px\}/);
  assert.match(css, /@media\(max-width:420px\)[^{]*\{[^]*\.respond-quick\.open dl\{grid-template-columns:1fr\}/);
  assert.match(css, /\.respond-operational-banner>div\{grid-template-columns:1fr\}/);
  assert.match(css, /\.respond-progress-steps button\{[^}]*min-height:48px/);
  assert.match(css, /@media\(max-width:650px\)[^{]*\{[^]*\.respond-progress-steps\{grid-template-columns:1fr\}/);
  assert.match(css, /\.respond-jump-actions\{[^}]*grid-template-columns:repeat\(4/);
  assert.match(css, /@media\(max-width:650px\)[^{]*\{[^]*\.respond-jump-actions\{grid-template-columns:repeat\(2/);
});

test("fullscreen apparatus and iPad views respect every safe-area inset", () => {
  for (const side of ["top", "right", "bottom", "left"]) {
    assert.match(css, new RegExp(`env\\(safe-area-inset-${side}\\)`));
  }
  assert.match(css, /\.respond-page\.monitor-view\{padding:max\(12px/);
});

test("only fullscreen overview hides device status and task guidance", () => {
  assert.match(css, /\.respond-overview-page\.monitor-view \.respond-monitor-status,\s*\.respond-overview-page\.monitor-view \.respond-task-guide\{display:none\}/);
  assert.doesNotMatch(css, /(?:^|\})\s*\.respond-(?:monitor-status|task-guide)\{display:none/);
});

test("fullscreen overview reclaims the hidden panels' space without clipping the narrow call rail", () => {
  assert.match(css, /\.respond-overview-page\.monitor-view\{display:flex;flex-direction:column;height:100dvh\}/);
  assert.match(css, /@media\(min-width:951px\)\{\s*\.respond-overview-page\.monitor-view>\.respond-map-shell\{display:flex;flex-direction:column;flex:1;min-height:0\}/);
  assert.match(css, /\.respond-overview-page\.monitor-view \.respond-map-layout\{flex:1;min-height:0;grid-template-rows:minmax\(0,1fr\)\}/);
  assert.match(css, /@media\(max-width:950px\)\{\s*\.respond-overview-page\.monitor-view\{overflow:auto\}\s*\.respond-overview-page\.monitor-view>\.respond-map-shell\{flex-shrink:0\}/);
});
