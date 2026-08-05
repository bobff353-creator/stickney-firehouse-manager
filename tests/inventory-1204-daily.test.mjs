import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL("../supabase/migrations/20260805002817_seed_1204_daily_checklist.sql", import.meta.url),
  "utf8",
);

test("1204 daily check mirrors approved form 431 in four operational sections", () => {
  assert.match(migration, /where department_id = stickney_id and name = '1204'/);
  assert.match(migration, /'1204 Daily Check form 431'/);
  assert.match(migration, /'Vehicle'/);
  assert.match(migration, /'Pump \/ Booster Tank'/);
  assert.match(migration, /'Cab'/);
  assert.match(migration, /'Tools & Equipment'/);
  assert.equal((migration.match(/'form-431-\d{3}'/g) || []).length, 28);
});

test("1204 daily check preserves truck-specific readings and readiness checks", () => {
  assert.match(migration, /'Record engine hours'/);
  assert.match(migration, /'DEF - refill at 1\/2'/);
  assert.match(migration, /'Outrigger stabilizers and aerial operational'/);
  assert.match(migration, /'Record pump hours'/);
  assert.match(migration, /'Portable radios - charged and on channel 1',4/);
  assert.match(migration, /array\['daily'\]/);
});
