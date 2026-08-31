import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const panel = fs.readFileSync(new URL("../app/preplans/operational-panel.tsx", import.meta.url), "utf8");
const route = fs.readFileSync(new URL("../app/api/field-preplans/operational/route.ts", import.meta.url), "utf8");
const field = fs.readFileSync(new URL("../app/field-preplans.tsx", import.meta.url), "utf8");

test("operational editing is presented as a guided four-step workflow", () => {
  for (const label of ["Building & floors", "Hazards & response", "Map & resources", "Review & publish"]) {
    assert.match(panel, new RegExp(label.replace("&", "&")));
  }
  assert.match(panel, /STEP \{workflowIndex\+1\} OF \{workflowSteps\.length\}/);
  assert.match(panel, /Continue to step/);
  assert.match(panel, /Save and continue/);
  assert.match(panel, /scrollIntoView\(\{behavior:"smooth",block:"start"\}\)/);
  assert.match(panel, /Saved information found/);
});

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
  assert.match(panel, /Verified route segments/);
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
  assert.match(panel, /Hydrant → A-side route/);
  assert.match(panel, /Click the map to add roadway or driveway bends/);
  assert.match(panel, /path:mapDraft/);
  assert.match(panel, /routeDistanceFeet/);
  assert.match(field, /operational-hose-map-overlay/);
  assert.match(field, /operationalMapDraft\.points\.slice\(1,-1\)/);
  assert.match(panel, /Saved drawn route/);
  assert.match(panel, /Drawn route geometry not recorded/);
  assert.match(route, /path\.length<2/);
  assert.match(route, /Draw a valid hose route with at least two map points/);
  assert.match(route, /json\(path,\[\]\)/);
  assert.match(route, /path:parseJson\(item\.path,\[\]\)/);
});

test("room and stair authoring persists CAD terms and floor-specific map geometry", () => {
  assert.match(panel, /Draw on the building map/);
  assert.match(panel, /Room overlay is ready to save/);
  assert.match(panel, /CAD keywords/);
  assert.match(panel, /<option value="stair">Stair<\/option>/);
  assert.match(panel, /geometry:mapDraft/);
  assert.match(panel, /The map displays operational drawings for this level only/);
  assert.match(field, /operational-space-map-overlay/);
  assert.match(route, /Draw a valid room polygon with at least three map corners/);
  assert.match(route, /room_number=excluded\.room_number/);
  assert.match(route, /json\(geometry,\[\]\)/);
});

test("saved rooms can be selected, edited, moved, reshaped, and safely removed", () => {
  assert.match(panel, /Tap a room on the map or choose one here/);
  assert.match(panel, /Edit room/);
  assert.match(panel, /Move \/ reshape/);
  assert.match(panel, /Remove room/);
  assert.match(panel, /spaceId:space\.id,points/);
  assert.match(panel, /Drag the blue room to move the whole shape/);
  assert.match(field, /aria-label=\{onOperationalSpaceSelect\?`Select room/);
  assert.match(field, /operationalDrag\.current=\{kind:"space"/);
  assert.match(field, /operationalDrag\.current=\{kind:"corner"/);
  assert.match(route, /\["level","space","annotation","hoseLay"\]/);
  assert.match(route, /field_preplan_spaces SET archived=1/);
  assert.match(route, /active alerts and hazardous materials linked to this room/);
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
