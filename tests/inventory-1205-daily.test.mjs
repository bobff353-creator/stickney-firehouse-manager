import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL("../supabase/migrations/20260805003433_seed_1205_daily_checklist.sql", import.meta.url),
  "utf8",
);

test("1205 daily check mirrors approved form 265 in seven operational sections", () => {
  assert.match(migration, /where department_id = stickney_id and name = '1205'/);
  assert.match(migration, /'1205 Daily Check form 265'/);
  for (const section of ["Cab", "Engine Compartment", "Oxygen", "Lights & Electrical", "Cot", "SCBA", "Miscellaneous"]) {
    assert.match(migration, new RegExp(`'${section.replace("&", "&")}'`));
  }
  assert.equal((migration.match(/'form-265-\d{3}'/g) || []).length, 34);
});

test("1205 daily check preserves ambulance medical and pressure readiness items", () => {
  assert.match(migration, /'Perform morning ambulance \/ engine medication checklist'/);
  assert.match(migration, /'Portable radios',2/);
  assert.match(migration, /'On-board oxygen PSI - replace at 500 PSI'/);
  assert.match(migration, /'Cot battery charged'/);
  assert.match(migration, /'Driver SCBA PSI'/);
  assert.match(migration, /array\['daily'\]/);
});
