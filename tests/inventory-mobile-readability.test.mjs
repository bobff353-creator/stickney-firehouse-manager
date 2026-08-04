import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("mobile equipment editor keeps inspection choices readable in dark mode", async () => {
  const styles = await readFile(new URL("../app/inventory/inventory.css", import.meta.url), "utf8");
  assert.match(styles, /\.equipment-editor \.ops-check-grid label\{min-height:44px;[^}]*font-size:12px/);
  assert.match(styles, /\.equipment-editor \.ops-check-grid label\{min-height:50px;font-size:13px\}/);
  assert.match(styles, /@media\(prefers-color-scheme:dark\)\{\.equipment-editor \.ops-check-grid label\{[^}]*color:#f4f8fa/);
});
