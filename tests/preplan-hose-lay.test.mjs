import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import {
  compareToApparatusCapacity,
  isValidHoseSize,
  isValidSegments,
  recommendedHoseFeet,
  segmentDistanceFeet,
  totalDistanceFeet,
} from "../app/preplans/hose-lay.ts";

test("segmentDistanceFeet computes a real geodesic distance, not a placeholder", () => {
  // Roughly 1 degree of latitude ~= 364,000 ft; 0.001 degrees ~= 364 ft.
  const feet = segmentDistanceFeet({ fromLat: 41.8189, fromLng: -87.7734, toLat: 41.8199, toLng: -87.7734 });
  assert.ok(feet > 300 && feet < 420, `expected ~364 ft, got ${feet}`);
});

test("totalDistanceFeet sums every segment in a multi-segment route", () => {
  const segments = [
    { fromLat: 41.8189, fromLng: -87.7734, toLat: 41.8199, toLng: -87.7734 },
    { fromLat: 41.8199, fromLng: -87.7734, toLat: 41.8199, toLng: -87.7744 },
  ];
  const total = totalDistanceFeet(segments);
  const sumOfParts = segmentDistanceFeet(segments[0]) + segmentDistanceFeet(segments[1]);
  assert.equal(Math.round(total), Math.round(sumOfParts));
});

test("Scenario D — 642 ft measured + 100 ft reserve rounds up to 800 ft at 100 ft sections", () => {
  assert.equal(recommendedHoseFeet(642, 100, 100), 800);
});

test("recommendedHoseFeet rounds up to the next full section, never leaving a partial short", () => {
  assert.equal(recommendedHoseFeet(650, 0, 100), 700);
  assert.equal(recommendedHoseFeet(700, 0, 100), 700, "exact multiple needs no extra section");
  assert.equal(recommendedHoseFeet(701, 0, 100), 800);
});

test("recommendedHoseFeet falls back to a plain ceiling when section length is not configured", () => {
  assert.equal(recommendedHoseFeet(642.4, 100, 0), 743);
});

test("Scenario D — sufficient verified apparatus capacity reports sufficient with zero deficit", () => {
  const result = compareToApparatusCapacity(800, 1000);
  assert.deepEqual(result, { status: "sufficient", recommendedFeet: 800, availableFeet: 1000, deficitFeet: 0 });
});

test("insufficient verified apparatus capacity reports the exact deficit, never silently passing", () => {
  const result = compareToApparatusCapacity(800, 600);
  assert.deepEqual(result, { status: "deficit", recommendedFeet: 800, availableFeet: 600, deficitFeet: 200 });
});

test("missing apparatus inventory is reported as unverified, never treated as zero capacity", () => {
  assert.deepEqual(compareToApparatusCapacity(800, null), { status: "unverified", recommendedFeet: 800 });
  assert.deepEqual(compareToApparatusCapacity(800, undefined), { status: "unverified", recommendedFeet: 800 });
  assert.deepEqual(compareToApparatusCapacity(800, NaN), { status: "unverified", recommendedFeet: 800 });
});

test("segment and hose-size validation reject malformed input", () => {
  assert.equal(isValidSegments([]), false);
  assert.equal(isValidSegments([{ fromLat: 200, fromLng: 0, toLat: 0, toLng: 0 }]), false);
  assert.equal(isValidSegments([{ fromLat: 41.8, fromLng: -87.7, toLat: 41.81, toLng: -87.71 }]), true);
  assert.equal(isValidHoseSize(4), true);
  assert.equal(isValidHoseSize(2.5), true);
  assert.equal(isValidHoseSize(6), false, "not a standard fire hose size");
});

test("bootstrap creates field_preplan_hose_lays linked to a hydrant, level, and destination feature", async () => {
  const bootstrap = await readFile(new URL("../db/bootstrap.ts", import.meta.url), "utf8");
  assert.match(bootstrap, /CREATE TABLE IF NOT EXISTS field_preplan_hose_lays/);
  assert.match(bootstrap, /source_hydrant_id TEXT REFERENCES field_hydrants\(id\)/);
  assert.match(bootstrap, /destination_feature_id TEXT REFERENCES field_preplan_features\(id\)/);
  assert.match(bootstrap, /verified_available_feet REAL/);
});
