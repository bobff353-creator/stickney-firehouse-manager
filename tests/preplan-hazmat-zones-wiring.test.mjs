import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("field-preplans API exposes hazmat zones, validates geometry, and cross-checks the linked hazmat record", async () => {
  const api = await read("../app/api/field-preplans/route.ts");
  assert.match(api, /field_preplan_hazmat_zones/);
  assert.match(api, /action === "saveHazmatZone"/);
  assert.match(api, /action === "deleteHazmatZone"/);
  assert.match(api, /isValidZoneGeometry/);
  assert.match(api, /does not belong to this preplan/);
  // Deleting a HazMat record must not leave orphaned zones referencing it.
  assert.match(api, /UPDATE field_preplan_hazmat_zones SET hazmat_id=NULL WHERE hazmat_id=\?/);
});

test("respond API sorts hazmat zones by severity (hot first)", async () => {
  const api = await read("../app/api/respond/route.ts");
  assert.match(api, /sortZonesBySeverity/);
  assert.match(api, /field_preplan_hazmat_zones WHERE preplan_id=\?/);
});

test("Field Preplans lets HazMat-permitted users add isolation/evacuation zones with radius presets, without suggesting a distance", async () => {
  const page = await read("../app/field-preplans.tsx");
  assert.match(page, /action:"saveHazmatZone"/);
  assert.match(page, /action:"deleteHazmatZone"/);
  assert.match(page, /radiusPresetsFeet/);
  assert.match(page, /100,300,500,1000/);
  assert.match(page, /No safety distance is suggested/);
});

test("Respond folds linked zone info into the HazMat quick-info detail", async () => {
  const page = await read("../app/respond.tsx");
  assert.match(page, /plan\.hazmatZones\?\?\[\]\)\.filter\(\(zone\)=>zone\.hazmatId===item\.id\)/);
  assert.match(page, /Zones: \$\{zones\.map/);
});
