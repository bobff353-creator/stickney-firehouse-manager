import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const operations = await readFile(new URL("../app/inventory-operations.tsx", import.meta.url), "utf8");
const route = await readFile(new URL("../app/api/operations/route.ts", import.meta.url), "utf8");
const migration = await readFile(new URL("../supabase/migrations/20260813014455_add_check_item_odometer_reading.sql", import.meta.url), "utf8");

test("mileage and odometer checklist items use a numeric entry instead of result buttons", () => {
  assert.match(operations, /\(mileage\|odometer\)/i);
  assert.match(operations, /type="number"/);
  assert.match(operations, /inputMode="decimal"/);
  assert.match(operations, /Save reading/);
  assert.match(operations, /numericItem \? <div className="numeric-reading-entry"/);
});

test("server validates and stores a nonnegative numeric reading", () => {
  assert.match(route, /Enter the required numeric reading/);
  assert.match(route, /numeric_reading: isNumericReadingItem \? numericReading : null/);
  assert.match(route, /numericReading === null/);
  assert.match(route, /numericReading < 0/);
  assert.match(route, /result !== "pass"/);
});

test("migration adds a durable nonnegative numeric reading without changing ordinary results", () => {
  assert.match(migration, /add column if not exists numeric_reading numeric/);
  assert.match(migration, /numeric_reading is null or numeric_reading >= 0/);
  assert.doesNotMatch(migration, /drop column|delete from|update /i);
});
