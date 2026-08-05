import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL("../supabase/migrations/20260805005921_seed_daily_drug_inventory_by_vehicle.sql", import.meta.url),
  "utf8",
);

test("daily drug inventory form 338 is assigned only to its five named vehicles", () => {
  assert.match(migration, /array\['1201','1203','1204','1205','1207'\]/);
  assert.match(migration, /'Daily Drug Inventory form 338'/);
  assert.equal((migration.match(/'Medication - Jump Bag','jump'/g) || []).length, 5);
  assert.equal((migration.match(/'Medication - Cabinet','cabinet'/g) || []).length, 2);
  assert.match(migration, /array\['daily'\]/);
});

test("drug quantities and expiration checks preserve all eight form medications", () => {
  for (const medication of ["Albuterol", "Atrovent", "Oral Glucose", "Glucagon", "Zofran", "Narcan", "Epinephrine", "Aspirin"]) {
    assert.match(migration, new RegExp(`'${medication} - verify quantity and expiration'`));
  }
  assert.match(migration, /'Oral Glucose - verify quantity and expiration','oral-glucose',2,2/);
  assert.match(migration, /'Albuterol - verify quantity and expiration','albuterol',1,2/);
  assert.match(migration, /'Epinephrine - verify quantity and expiration','epinephrine',2,2/);
});
