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

test("hose-lay authoring persists measured segments, a verified source, and auditable inventory context", () => {
  assert.match(panel, /Route segments/);
  assert.match(panel, /Source hydrant/);
  assert.match(panel, /Apparatus \/ inventory reference/);
  assert.match(panel, /Inventory verified at/);
  assert.match(panel, /archiveOperationalRecord\("hoseLay",item\.id\)/);
  assert.match(route, /Route segment distances must equal the measured route total/);
  assert.match(route, /The selected source hydrant was not found/);
  assert.match(route, /Verified apparatus capacity requires an apparatus reference and verification date/);
  assert.match(route, /The selected active apparatus was not found/);
  assert.match(route, /FROM fleet_apparatus/);
});

test("hose-lay authoring requires and presents persisted drawn route geometry", () => {
  assert.match(panel, /Draw route geometry/);
  assert.match(panel, /Hose route drawing surface/);
  assert.match(panel, /path:hosePath/);
  assert.match(panel, /Saved drawn route/);
  assert.match(panel, /Drawn route geometry not recorded/);
  assert.match(route, /path\.length<2/);
  assert.match(route, /Draw a valid hose route with at least two preplan points/);
  assert.match(route, /json\(path,\[\]\)/);
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

test("revision restoration is permission-gated, validated, and creates a new audited revision", () => {
  assert.match(route, /action === "restoreRevision"/);
  assert.match(route, /field_preplans\.publish/);
  assert.match(route, /parseSnapshot\(stored\.snapshot,preplanId\)/);
  assert.match(route, /restored_from_revision/);
  assert.match(route, /"restoreRevision",summary,user/);
  assert.match(route, /revision = Math\.max[\s\S]*\+1/);
});

test("revision UI discloses restore scope and requires an explicit confirmation", () => {
  assert.match(panel, /Revision history/);
  assert.match(panel, /Restore as new revision/);
  assert.match(panel, /window\.confirm/);
  assert.match(panel, /Current private attachments and legacy mapped systems (?:will be|are) preserved/);
  assert.doesNotMatch(route.match(/const restoreTables = \{[\s\S]*?\} as const;/)?.[0] ?? "", /field_preplan_assets|field_preplan_features/);
});

test("layer cleanup protects Arrival and requires child records to be archived first", () => {
  assert.match(panel, /archiveOperationalRecord\("annotation",item\.id\)/);
  assert.match(panel, /Archive selected level/);
  assert.match(route, /The default Arrival level cannot be archived/);
  assert.match(route, /Archive active records on this level before archiving the level/);
  assert.match(route, /field_preplan_annotations SET archived=1/);
});
