import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL("../supabase/migrations/20260805005409_seed_1209_daily_checklist.sql", import.meta.url),
  "utf8",
);

test("1209 daily check mirrors approved form 268 in three operational sections", () => {
  assert.match(migration, /where department_id = stickney_id and name = '1209'/);
  assert.match(migration, /'1209 Daily Check form 268'/);
  for (const section of ["Cab", "Engine Compartment", "Lights & Electrical"]) {
    assert.match(migration, new RegExp(`'${section}'`));
  }
  assert.equal((migration.match(/'form-268-\d{3}'/g) || []).length, 20);
});

test("1209 daily check preserves utility-specific fluid and electrical checks", () => {
  assert.match(migration, /'Knox Box keys'/);
  assert.match(migration, /'Transmission fluid - engine on and vehicle in park'/);
  assert.match(migration, /'Antifreeze \/ coolant level'/);
  assert.match(migration, /'Brake lights'/);
  assert.match(migration, /'Siren'/);
  assert.match(migration, /array\['daily'\]/);
});
