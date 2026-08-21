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

test("Respond returns the feature level and verification metadata", () => {
  assert.match(route, /primary_level_id primaryLevelId/);
  assert.match(route, /verified_at verifiedAt/);
  assert.match(source, /levelId: feature\.primaryLevelId/);
  assert.match(source, /verifiedAt: feature\.verifiedAt/);
});

test("feature detail names the level, location, status, photo, and verification", () => {
  for (const label of [
    "Published level",
    "Location description",
    "Last verification",
    "Status",
  ]) {
    assert.match(source, new RegExp(label));
  }
  assert.match(source, /selectedFeaturePhoto/);
  assert.match(source, /No location description entered/);
  assert.match(source, /Not verified/);
});

test("mapped coordinates offer explicit walking directions", () => {
  assert.match(source, /maps\/dir\/\?api=1&destination=/);
  assert.match(source, /travelmode=walking/);
  assert.match(source, /Walking directions/);
});
