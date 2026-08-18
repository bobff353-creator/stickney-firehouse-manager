import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("field-preplans API exposes risk factors and target-hazard fields, gated on officer permission", async () => {
  const api = await read("../app/api/field-preplans/route.ts");
  assert.match(api, /field_preplan_risk_factors/);
  assert.match(api, /action === "saveRiskFactor"/);
  assert.match(api, /action === "deleteRiskFactor"/);
  assert.match(api, /action === "saveTargetHazard"/);
  assert.match(api, /isValidRiskScore/);
  // A Target Hazard designation must always carry at least one stated reason.
  assert.match(api, /isValidTargetHazardDesignation/);
  assert.match(api, /canManageLayers.*Officer permission is required/s);
});

test("respond API computes the effective classification (override-aware) and returns target-hazard reasons", async () => {
  const api = await read("../app/api/respond/route.ts");
  assert.match(api, /effectiveClassification/);
  assert.match(api, /classifyRisk/);
  assert.match(api, /targetHazardReasons/);
});

test("Field Preplans has a Risk tab showing the transparent computed classification and a Target Hazard designation form", async () => {
  const page = await read("../app/field-preplans.tsx");
  assert.match(page, />Risk</);
  assert.match(page, /action:"saveRiskFactor"/);
  assert.match(page, /action:"saveTargetHazard"/);
  assert.match(page, /Computed classification/);
});

test("Respond shows a Target Hazard banner ahead of the critical alert banners, with reasons listed", async () => {
  const page = await read("../app/respond.tsx");
  const targetHazardIndex = page.indexOf("respond-target-hazard-banner");
  const alertBannerIndex = page.indexOf("respond-alert-banner");
  assert.ok(targetHazardIndex > -1);
  assert.ok(targetHazardIndex < alertBannerIndex, "Target Hazard banner must render ahead of ordinary critical alerts");
  assert.match(page, /TARGET HAZARD/);
  assert.match(page, /targetHazardReasons!\.map/);
});
