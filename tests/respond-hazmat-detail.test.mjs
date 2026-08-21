import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const route = fs.readFileSync(
  new URL("../app/api/respond/route.ts", import.meta.url),
  "utf8",
);
const source = fs.readFileSync(
  new URL("../app/respond.tsx", import.meta.url),
  "utf8",
);

test("Respond loads complete published HazMat emergency fields and active zones", () => {
  for (const field of [
    "exactLocation",
    "nfpaHealth",
    "nfpaFlammability",
    "nfpaInstability",
    "nfpaSpecial",
    "dateVerified",
  ])
    assert.match(route, new RegExp(field));
  assert.match(
    route,
    /FROM field_preplan_hazmat_zones WHERE preplan_id=\? AND archived=0/,
  );
  assert.match(route, /hazmatZones:\s*hazmatZones\.results\s*\.filter/);
});

test("HazMat detail exposes the required emergency information without invented values", () => {
  for (const label of [
    "Quantity / container",
    "Physical state",
    "Exact location",
    "NFPA 704",
    "Date verified",
    "Isolation / evacuation zones",
    "SDS",
    "Operational warning",
  ])
    assert.match(source, new RegExp(label));
  assert.match(source, /Quantity not verified/);
  assert.match(source, /No active zones recorded/);
  assert.match(source, /No SDS attachment recorded/);
});

test("SDS files stay on the authenticated private asset route", () => {
  assert.match(route, /hazmat_id hazmatId/);
  assert.match(source, /asset\.category\.toLowerCase\(\) === "sds"/);
  assert.match(
    source,
    /\/api\/field-preplans\/assets\/\$\{encodeURIComponent\(asset\.id\)\}/,
  );
});
