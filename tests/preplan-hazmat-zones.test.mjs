import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import {
  RADIUS_PRESETS_FEET,
  isValidCircleZone,
  isValidPolygonZone,
  isValidRadius,
  isValidZoneGeometry,
  sortZonesBySeverity,
  zoneDistanceLabel,
  zoneTypeLabel,
} from "../app/preplans/hazmat-zones.ts";

test("standard radius presets are 100/300/500/1000 feet, matching the spec's examples", () => {
  assert.deepEqual(RADIUS_PRESETS_FEET, [100, 300, 500, 1000]);
});

test("radius validation rejects zero, negative, non-finite, and absurdly large values", () => {
  assert.equal(isValidRadius(500), true);
  assert.equal(isValidRadius(0), false);
  assert.equal(isValidRadius(-100), false);
  assert.equal(isValidRadius(NaN), false);
  assert.equal(isValidRadius(Infinity), false);
  assert.equal(isValidRadius(100_000), false, "unreasonably large radius rejected as a sanity check");
});

test("a circle zone needs a valid center point in range and a positive radius", () => {
  assert.equal(isValidCircleZone({ shape: "circle", centerLat: 41.8, centerLng: -87.7, radiusFeet: 500 }), true);
  assert.equal(isValidCircleZone({ shape: "circle", centerLat: null, centerLng: -87.7, radiusFeet: 500 }), false);
  assert.equal(isValidCircleZone({ shape: "circle", centerLat: 200, centerLng: -87.7, radiusFeet: 500 }), false, "out of range latitude");
  assert.equal(isValidCircleZone({ shape: "circle", centerLat: 41.8, centerLng: -87.7, radiusFeet: null }), false);
  assert.equal(isValidCircleZone({ shape: "polygon", centerLat: 41.8, centerLng: -87.7, radiusFeet: 500 }), false, "wrong shape");
});

test("a polygon zone needs at least 3 in-range points and no more than the sanity cap", () => {
  assert.equal(isValidPolygonZone({ shape: "polygon", polygon: [{ lat: 41.8, lng: -87.7 }, { lat: 41.81, lng: -87.71 }] }), false, "only 2 points");
  assert.equal(isValidPolygonZone({ shape: "polygon", polygon: [{ lat: 41.8, lng: -87.7 }, { lat: 41.81, lng: -87.71 }, { lat: 41.82, lng: -87.72 }] }), true);
  assert.equal(isValidPolygonZone({ shape: "polygon", polygon: [{ lat: 200, lng: -87.7 }, { lat: 41.81, lng: -87.71 }, { lat: 41.82, lng: -87.72 }] }), false);
  assert.equal(isValidPolygonZone({ shape: "circle", polygon: [{ lat: 41.8, lng: -87.7 }, { lat: 41.81, lng: -87.71 }, { lat: 41.82, lng: -87.72 }] }), false, "wrong shape");
});

test("isValidZoneGeometry dispatches to the correct validator by shape", () => {
  assert.equal(isValidZoneGeometry({ shape: "circle", centerLat: 41.8, centerLng: -87.7, radiusFeet: 500, polygon: [] }), true);
  assert.equal(isValidZoneGeometry({ shape: "polygon", centerLat: null, centerLng: null, radiusFeet: null, polygon: [{ lat: 41.8, lng: -87.7 }, { lat: 41.81, lng: -87.71 }, { lat: 41.82, lng: -87.72 }] }), true);
});

test("zones sort with the most restrictive (hot) first, per Scenario B ordering", () => {
  const zones = [
    { zoneType: "evacuation" }, { zoneType: "cold" }, { zoneType: "hot" }, { zoneType: "warm" }, { zoneType: "isolation" },
  ];
  const sorted = sortZonesBySeverity(zones);
  assert.deepEqual(sorted.map((z) => z.zoneType), ["hot", "isolation", "warm", "evacuation", "cold"]);
});

test("zone type labels are human readable", () => {
  assert.equal(zoneTypeLabel("hot"), "Hot Zone");
  assert.equal(zoneTypeLabel("evacuation"), "Evacuation Zone");
});

test("zoneDistanceLabel reports the entered radius, never an inferred one", () => {
  assert.equal(zoneDistanceLabel({ shape: "circle", radiusFeet: 500 }), "500 ft radius");
  assert.equal(zoneDistanceLabel({ shape: "polygon", radiusFeet: null }), "Custom outline");
});

test("bootstrap creates field_preplan_hazmat_zones linked to both the preplan and an optional hazmat record", async () => {
  const bootstrap = await readFile(new URL("../db/bootstrap.ts", import.meta.url), "utf8");
  assert.match(bootstrap, /CREATE TABLE IF NOT EXISTS field_preplan_hazmat_zones/);
  assert.match(bootstrap, /hazmat_id TEXT REFERENCES field_preplan_hazmat\(id\)/);
  assert.match(bootstrap, /radius_feet REAL/);
  assert.match(bootstrap, /field_preplan_hazmat_zone_hazmat_idx/);
});
