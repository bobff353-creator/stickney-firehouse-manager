import assert from "node:assert/strict";
import test from "node:test";
import { ERG_SOURCE, lookupErgMaterial, normalizeErgId, protectiveDistancesFor } from "../app/preplans/erg.ts";

const dataset = { source:ERG_SOURCE, importedAt:"2026-08-20T00:00:00Z", sourceSha256:"verified-fixture", materials:[
  {idNumber:"UN1203",materialName:"Gasoline",guideNumber:"128",highlighted:false},
], protectiveDistances:[
  {idNumber:"1203",materialName:"Gasoline",container:"test fixture",spillSize:"small",timeOfDay:"day",initialIsolationMeters:25,protectiveActionKilometers:0.1},
] };

test("ERG lookup normalizes UN and NA identifiers", () => {
  assert.equal(normalizeErgId("un 1203"), "1203");
  assert.equal(lookupErgMaterial("1203", dataset)[0].guideNumber, "128");
  assert.equal(protectiveDistancesFor("UN1203", dataset).length, 1);
});

test("ERG source remains pinned to official PHMSA 2024 metadata", () => {
  assert.equal(ERG_SOURCE.edition, "ERG2024");
  assert.match(ERG_SOURCE.landingPage, /^https:\/\/www\.phmsa\.dot\.gov\//);
  assert.equal(ERG_SOURCE.effectiveDate, "2024-04-04");
});
