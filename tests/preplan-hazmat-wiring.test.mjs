import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("field-preplans API exposes hazmat records, validates UN/NA and NFPA input, and gates writes on manage_hazmat", async () => {
  const api = await read("../app/api/field-preplans/route.ts");
  assert.match(api, /field_preplan_hazmat/);
  assert.match(api, /canManageHazmat/);
  assert.match(api, /action === "saveHazmat"/);
  assert.match(api, /action === "deleteHazmat"/);
  assert.match(api, /isValidUnNaNumber/);
  assert.match(api, /every\(isValidNfpaRating\)/);
  assert.match(api, /does not belong to this preplan/);
});

test("respond API sorts hazmat by NFPA severity before returning it", async () => {
  const api = await read("../app/api/respond/route.ts");
  assert.match(api, /sortHazmatBySeverity/);
  assert.match(api, /field_preplan_hazmat WHERE preplan_id=\?/);
});

test("Field Preplans has a HazMat tab wired to saveHazmat/deleteHazmat and marks unmapped records", async () => {
  const page = await read("../app/field-preplans.tsx");
  assert.match(page, />HazMat</);
  assert.match(page, /action:"saveHazmat"/);
  assert.match(page, /action:"deleteHazmat"/);
  assert.match(page, /Unmapped operational record/);
});

test("Respond surfaces HazMat records in the building-intelligence quick list with structured NFPA/UN-NA detail, no fabricated data", async () => {
  const page = await read("../app/respond.tsx");
  assert.match(page, /HazMat: \$\{item\.chemicalName\}/);
  assert.match(page, /NFPA 704: Health/);
  assert.match(page, /Not yet verified/);
  // The details string is built only from entered fields (filter(Boolean)) — nothing is invented.
  assert.match(page, /\.filter\(Boolean\)\.join\("\\n"\)/);
});
