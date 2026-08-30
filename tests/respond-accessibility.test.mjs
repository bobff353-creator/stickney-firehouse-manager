import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const respond = fs.readFileSync("app/respond.tsx", "utf8");
const css = fs.readFileSync("app/globals.css", "utf8");

test("Respond tactical views expose one keyboard-operable tab set", () => {
  assert.match(respond, /role="tablist" aria-label="Response tactical views"/);
  assert.match(respond, /role="tab"/);
  assert.match(respond, /aria-selected=\{view === item\}/);
  assert.match(respond, /aria-controls=\{`respond-panel-\$\{item\}`\}/);
  assert.match(respond, /role="tabpanel"/);
  assert.match(respond, /aria-labelledby=\{`respond-tab-\$\{view\}`\}/);
});

test("Respond tabs support arrow, Home, and End navigation", () => {
  for (const key of [
    "ArrowLeft",
    "ArrowRight",
    "ArrowUp",
    "ArrowDown",
    "Home",
    "End",
  ]) {
    assert.match(respond, new RegExp(key));
  }
  assert.match(respond, /event\.preventDefault\(\)/);
  assert.match(respond, /buttons\?\.item\(target\)\.focus\(\)/);
});

test("Respond tactical controls retain fireground touch targets on phone and iPad", () => {
  assert.match(css, /nav\[role="tablist"\] button\{min-height:44px/);
  assert.match(css, /\.respond-empty a,\.respond-empty button\{min-height:44px/);
  assert.match(
    css,
    /@media\(max-width:800px\)[^{]*\{\.respond-context>nav\[role="tablist"\] button\{min-height:48px/,
  );
  assert.match(css, /touch-action:manipulation/);
});

test("Respond operational detail dialogs support Escape and restore trigger focus", () => {
  assert.match(respond, /role="dialog"/);
  assert.match(respond, /aria-modal="false"/);
  assert.match(respond, /aria-labelledby="respond-hazmat-detail-title"/);
  assert.match(respond, /respond-quick-information-title/);
  assert.match(respond, /event\.key !== "Escape"/);
  assert.match(respond, /document\.addEventListener\("keydown", closeOnEscape\)/);
  assert.match(respond, /hazmatTriggerRef\.current/);
  assert.match(respond, /quickTriggerRef\.current/);
  assert.match(respond, /requestAnimationFrame\(\(\) => target\?\.focus\(\)\)/);
});

test("Respond footprint has a keyboard and screen-reader map alternative", () => {
  assert.match(respond, /aria-hidden="true"\s+focusable="false"/);
  assert.match(respond, /aria-labelledby="respond-mapped-systems-title"/);
  assert.match(respond, /id="respond-mapped-systems-title">Mapped system locations/);
  assert.match(respond, /onSelect\(item, event\.currentTarget\)/);
  assert.match(respond, /aria-pressed=\{selectedId === feature\.id\}/);
  assert.match(respond, /No mapped fire-protection systems are published/);
  assert.match(css, /respond-footprint-alternative button\{[^}]*min-height:44px/);
});

test("Respond exposes clear device progress and one-tap tactical navigation", () => {
  assert.match(respond, /aria-label="Field response controls"/);
  assert.match(respond, /aria-label="Crew response progress on this device"/);
  assert.match(respond, /aria-pressed=\{isCurrent\}/);
  assert.match(respond, /does not change CAD status/);
  assert.match(respond, /aria-label="Open response information"/);
  assert.match(respond, /document\.getElementById\(`respond-tab-\$\{nextView\}`\)\?\.focus\(\)/);
});
