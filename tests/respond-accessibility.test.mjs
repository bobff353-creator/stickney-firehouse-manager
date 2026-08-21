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
  assert.match(
    css,
    /@media\(max-width:800px\)[^{]*\{\.respond-context>nav\[role="tablist"\] button\{min-height:48px/,
  );
  assert.match(css, /touch-action:manipulation/);
});
