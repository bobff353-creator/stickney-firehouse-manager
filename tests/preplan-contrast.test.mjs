import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

test("Preplan light and dark surfaces retain explicit AA label palettes", () => {
  assert.match(css, /\.preplan-record-metrics span,[^{]+\{color:#596d79/);
  assert.match(css, /\.preplan-record-empty\{color:#596d79\}/);
  assert.match(css, /\.operational-preplan-panel \.revision-history summary\{color:#dceaf4\}/);
  assert.match(css, /\.operational-preplan-panel \.revision-history li span,[^{]+\{color:#b7cad8\}/);
  assert.match(css, /\.respond-idle-actions span,\.respond-empty\{color:#596d79\}/);
});
