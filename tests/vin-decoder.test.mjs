import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("VIN decoder uses the official NHTSA service and validates VIN characters", async () => {
  const source = await read("app/lib/vin-decoder.ts");
  assert.match(source, /https:\/\/vpic\.nhtsa\.dot\.gov\/api\/vehicles/);
  assert.match(source, /DecodeVinValuesExtended/);
  assert.match(source, /\^\[A-HJ-NPR-Z0-9\]\{17\}\$/);
  assert.match(source, /did not report/);
});

test("VIN APIs remain authenticated, same-origin, and setup-permission protected", async () => {
  const [vinRoute, twinRoute] = await Promise.all([read("app/api/vin/route.ts"), read("app/api/digital-twin/route.ts")]);
  for (const source of [vinRoute, twinRoute]) {
    assert.match(source, /verifyInventoryRequest/);
    assert.match(source, /sameOriginInventoryRequest/);
    assert.match(source, /inventory\.setup\.manage/);
  }
  assert.match(twinRoute, /decode_and_save_vin/);
  assert.match(twinRoute, /update_vehicle_service_profile/);
  assert.match(twinRoute, /apparatus\.vin_decoded/);
  assert.match(twinRoute, /apparatus\.service_profile_verified/);
});

test("builder exposes scanning, truthful review, and department verification", async () => {
  const source = await read("app/inventory-vin-profile.tsx");
  assert.match(source, /Scan VIN/);
  assert.match(source, /Decode VIN/);
  assert.match(source, /NHTSA vPIC/);
  assert.match(source, /Missing values mean not reported/);
  assert.match(source, /Save & mark service details verified/);
  assert.match(source, /ownerManualUrl/);
  assert.match(source, /partsCatalogUrl/);
  assert.match(source, /maintenanceSchedule/);
});

test("migration keeps VIN facts separate from verified maintenance data", async () => {
  const migration = await read("supabase/migrations/20260813003530_add_inventory_vehicle_service_profile.sql");
  assert.match(migration, /vin_decoded_json jsonb/);
  assert.match(migration, /maintenance_schedule text/);
  assert.match(migration, /service_profile_verified_by uuid references auth\.users/);
  assert.match(migration, /never inferred solely from a VIN/);
});
