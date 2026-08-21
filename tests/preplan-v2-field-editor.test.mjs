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

test("HazMat zones require a verified linked material and positive circle radius", () => {
  assert.match(panel, /saveHazmatZone/);
  assert.match(panel, /Select verified material/);
  assert.match(panel, /Radius \(feet\)/);
  assert.match(panel, /Map placement remains pending/);
  assert.match(route, /action === "saveHazmatZone"/);
  assert.match(route, /field_preplans\.manage_hazmat/);
  assert.match(route, /Circle zones require a positive radius in feet/);
  assert.match(route, /The selected HazMat record does not belong to this preplan/);
});

test("secure attachments use the authenticated asset API and accepted file types", () => {
  assert.match(panel, /new FormData\(\)/);
  assert.match(panel, /\/api\/field-preplans\/assets/);
  assert.match(panel, /image\/jpeg,image\/png,image\/webp,application\/pdf/);
  assert.match(panel, /Files are served only through the authenticated preplan endpoint/);
  assert.doesNotMatch(panel, /item\.objectKey/);
});
