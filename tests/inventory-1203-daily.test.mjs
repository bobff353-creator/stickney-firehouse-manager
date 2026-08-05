import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL("../supabase/migrations/20260805001249_seed_1203_daily_checklist.sql", import.meta.url),
  "utf8",
);

test("1203 daily check mirrors approved form 254 in four operational sections", () => {
  assert.match(migration, /where department_id = stickney_id and name = '1203'/);
  assert.match(migration, /'1203 Daily Check form 254'/);
  assert.match(migration, /'Vehicle'/);
  assert.match(migration, /'Pump \/ Booster Tank'/);
  assert.match(migration, /'Cab'/);
  assert.match(migration, /'Tools & Equipment'/);
  assert.equal((migration.match(/'form-254-\d{3}'/g) || []).length, 25);
});

test("1203 daily check keeps required quantities and readiness items from the source form", () => {
  assert.match(migration, /'Fuel - must be at least 3\/4'/);
  assert.match(migration, /'Portable radios - charged and on channel 1',4/);
  assert.match(migration, /'R\.I\.T\. bag - cylinder at 4500 PSI'/);
  assert.match(migration, /'Water tank level - Full required'/);
  assert.match(migration, /'Run and operate all power tools'/);
  assert.match(migration, /array\['daily'\]/);
});
