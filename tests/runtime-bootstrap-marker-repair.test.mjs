import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const bootstrap = readFileSync("db/bootstrap.ts", "utf8");
const migration = readFileSync(
  "supabase/migrations/20260831191500_restore_monthly_safety_inspection_bootstrap_marker.sql",
  "utf8",
);

test("repair migration restores the marker expected by the selected portal build", () => {
  const expectedMarker = "stickney-runtime-bootstrap-2026-08-31-monthly-safety-inspections-v1";
  assert.match(bootstrap, new RegExp(expectedMarker));
  assert.match(migration, new RegExp(expectedMarker));
});

test("repair migration verifies schema prerequisites before advancing the marker", () => {
  assert.match(migration, /safety_inspection_templates/);
  assert.match(migration, /safety_inspection_template_items/);
  assert.match(migration, /safety_inspection_attachments/);
  assert.match(migration, /information_schema\.columns/);
  assert.match(migration, /monthly-public-works-extinguishers/);
  assert.match(migration, /extinguisher_item_count <> 24/);
});
