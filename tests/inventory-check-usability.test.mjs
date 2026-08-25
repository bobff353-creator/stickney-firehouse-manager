import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const operations = await readFile(new URL("../app/inventory-operations.tsx", import.meta.url), "utf8");
const route = await readFile(new URL("../app/api/operations/route.ts", import.meta.url), "utf8");
const styles = await readFile(new URL("../app/inventory/inventory.css", import.meta.url), "utf8");

test("active checks are grouped, searchable, filterable, and show progress", () => {
  assert.match(operations, /check-progress-summary/);
  assert.match(operations, /Find an item/);
  assert.match(operations, /All locations/);
  assert.match(operations, /groupedActiveItems\.map/);
  assert.match(operations, /check-location-group/);
  assert.match(operations, /No items match these filters/);
});

test("individual item results update locally instead of reloading the dashboard", () => {
  const helper = operations.slice(
    operations.indexOf("async function recordCheckItems"),
    operations.indexOf("async function uploadEvidence"),
  );
  assert.match(helper, /setData\(\(current\)/);
  assert.match(helper, /savedById/);
  assert.doesNotMatch(helper, /await load\(/);
  assert.match(operations, /recordCheckItems\(`item-/);
  assert.match(operations, /recordCheckItems\("deficiency"/);
});

test("bulk location pass requires confirmation and excludes numeric readings", () => {
  assert.match(operations, /CONFIRM LOCATION/);
  assert.match(operations, /physically checking every listed item/);
  assert.match(operations, /action: "bulk_record_check_items"/);
  assert.match(route, /check\.check_type !== "inventory"/);
  assert.match(route, /\(mileage\|odometer\)/);
  assert.match(route, /\.eq\("result", "pending"\)/);
});

test("check controls remain touch-friendly on phones", () => {
  assert.match(styles, /\.check-actions button\{min-height:40px/);
  assert.match(styles, /@media\(max-width:820px\)\{\.check-worklist-tools\{grid-template-columns:1fr/);
  assert.match(styles, /\.check-actions button\{min-height:50px/);
  assert.match(styles, /\.check-completion-bar\{bottom:74px/);
});
