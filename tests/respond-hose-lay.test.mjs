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

test("Respond loads saved hose lays with their source hydrant and route", () => {
  assert.match(
    route,
    /LEFT JOIN field_hydrants hydrant ON hydrant\.id=lay\.source_hydrant_id/,
  );
  assert.match(route, /sourceHydrantNumber/);
  assert.match(route, /route: parseJson<unknown\[]>\(item\.path, \[]\)/);
});

test("Respond presents every required hose-lay field with truthful unknown states", () => {
  for (const label of [
    "Source hydrant",
    "Route distance",
    "Recommended hose",
    "Apparatus capacity",
    "Route",
  ])
    assert.match(source, new RegExp(label));
  assert.match(source, /Hydrant not verified/);
  assert.match(source, /Distance not verified/);
  assert.match(source, /Inventory not verified/);
  assert.match(source, /No saved route geometry/);
});

test("hose deficit is explicit and hydrant flows are never assumed additive", () => {
  assert.match(
    source,
    /Math\.max\(\s*0,\s*lay\.recommendedHoseFeet\s*-\s*lay\.apparatusCapacityFeet,?\s*\)/,
  );
  assert.match(source, /DEFICIT:/);
  assert.match(
    source,
    /Do not combine hydrant flows without a\s+verified water-main relationship/,
  );
});
