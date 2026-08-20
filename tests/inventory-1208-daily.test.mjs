import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL("../supabase/migrations/20260805004853_seed_1208_daily_checklist.sql", import.meta.url),
  "utf8",
);

test("1208 daily check mirrors approved form 266 in four operational sections", () => {
  assert.match(migration, /where department_id = stickney_id and name = '1208'/);
  assert.match(migration, /'1208 Daily Check form 266'/);
  for (const section of ["Cab", "Engine Compartment", "Lights & Electrical", "SCBA"]) {
    assert.match(migration, new RegExp(`'${section}'`));
  }
  assert.equal((migration.match(/'form-266-\d{3}'/g) || []).length, 22);
});

test("1208 daily check preserves utility-specific equipment and readiness items", () => {
  assert.match(migration, /'Set of irons'/);
  assert.match(migration, /'Box light'/);
  assert.match(migration, /'Antifreeze \/ coolant level'/);
  assert.match(migration, /'Brake lights'/);
  assert.match(migration, /'Driver SCBA PSI'/);
  assert.match(migration, /array\['daily'\]/);
});
