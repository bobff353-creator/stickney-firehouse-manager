import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const panel = fs.readFileSync(new URL("../app/preplans/operational-panel.tsx", import.meta.url), "utf8");
const route = fs.readFileSync(new URL("../app/api/field-preplans/operational/route.ts", import.meta.url), "utf8");

test("Field exposes persisted tactical annotation, hose-lay, and risk editors", () => {
  for (const action of ["saveAnnotation", "saveHoseLay", "saveRiskFactor"]) {
    assert.match(panel, new RegExp(action));
    assert.match(route, new RegExp(`action === ["']${action}["']`));
  }
  assert.match(panel, /Annotation name/);
  assert.match(panel, /Measured route/);
  assert.match(panel, /Verified apparatus capacity/);
  assert.match(panel, /Why this affects operations/);
  assert.match(panel, /Verified source/);
});

test("hose-lay and target-hazard results remain explicit for firefighters", () => {
  assert.match(panel, /Apparatus inventory unverified/);
  assert.match(panel, /DEFICIT:/);
  assert.match(panel, /TARGET HAZARD/);
  assert.match(panel, /Source:/);
  assert.match(panel, /recommendedHoseFeet/);
});
