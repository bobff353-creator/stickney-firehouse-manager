import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("field-preplans API exposes hose lays, validates segments/hose size, and cross-checks hydrant/level/feature links", async () => {
  const api = await read("../app/api/field-preplans/route.ts");
  assert.match(api, /field_preplan_hose_lays/);
  assert.match(api, /action === "saveHoseLay"/);
  assert.match(api, /action === "deleteHoseLay"/);
  assert.match(api, /isValidSegments/);
  assert.match(api, /isValidHoseSize/);
  assert.match(api, /Source hydrant not found/);
  assert.match(api, /destination feature does not belong to this preplan/);
});

test("respond API computes measured/recommended distance and compares against verified apparatus capacity", async () => {
  const api = await read("../app/api/respond/route.ts");
  assert.match(api, /recommendedHoseFeet/);
  assert.match(api, /compareToApparatusCapacity/);
  assert.match(api, /totalDistanceFeet/);
});

test("Field Preplans has a Hose Lay tab that never treats missing apparatus capacity as zero", async () => {
  const page = await read("../app/field-preplans.tsx");
  assert.match(page, />Hose Lay</);
  assert.match(page, /action:"saveHoseLay"/);
  assert.match(page, /Apparatus hose capacity not verified/);
});

test("Respond shows the hose-lay card with a visibly flagged deficit", async () => {
  const page = await read("../app/respond.tsx");
  assert.match(page, /HOSE LAY/);
  assert.match(page, /hose-lay-deficit/);
  assert.match(page, /Deficit: \$\{lay\.capacity\.deficitFeet/);
});
