import { test } from "node:test";
import assert from "node:assert/strict";
import {
  footprintMetrics,
  footprintIssue,
  footprintSchema,
  project,
  unproject,
} from "../app/arrival/lib/footprint.ts";
import {
  blankPlan,
  blankDetails,
  blockers,
  planSchema,
  systemWarnings,
} from "../app/arrival/lib/preplan.ts";
const R = 6371008.8,
  rad = Math.PI / 180;
function square(feet, lng = -87.76, lat = 41.82) {
  const d = (feet * 0.3048) / R / rad,
    x = d / Math.cos(lat * rad);
  return [
    [lng, lat],
    [lng + x, lat],
    [lng + x, lat + d],
    [lng, lat + d],
  ];
}
test("100 foot square has approximately 10,000 square feet and 400 feet perimeter", () => {
  const p = square(100),
    m = footprintMetrics([p]);
  assert.ok(Math.abs(m.areaSqFt - 10000) < 2);
  assert.ok(Math.abs(m.perimeterFt - 400) < 1);
  assert.equal(footprintIssue([p]), null);
});
test("courtyards are subtracted, ring direction does not change area", () => {
  const outer = square(100),
    small = square(25, outer[0][0] + 0.00005, outer[0][1] + 0.00005);
  assert.equal(footprintIssue([outer, small]), null);
  assert.ok(Math.abs(footprintMetrics([outer, small]).areaSqFt - 9375) < 2);
  assert.ok(
    Math.abs(
      footprintMetrics([outer.toReversed(), small.toReversed()]).areaSqFt -
        9375,
    ) < 2,
  );
});
test("self crossing, repeated corners, outside courtyards and invalid coordinates are rejected", () => {
  const p = square(100);
  assert.match(footprintIssue([[p[0], p[2], p[1], p[3]]]), /crosses/);
  assert.match(footprintIssue([[...p, p[0]]]), /repeated/);
  assert.match(footprintIssue([p, square(25, -88, 42)]), /large|inside/);
  assert.match(
    footprintIssue([
      [
        [0, 0],
        [NaN, 0],
        [1, 1],
      ],
    ]),
    /invalid/,
  );
});
test("map projection round trips geographic points", () => {
  const p = [-87.765, 41.82];
  const q = unproject(project(p));
  assert.ok(Math.abs(q[0] - p[0]) < 1e-9);
  assert.ok(Math.abs(q[1] - p[1]) < 1e-9);
});
test("stored polygon needs explicit check and is validated server side", () => {
  const p = {
    rings: [square(100)],
    source: "traced",
    sourceId: null,
    sourceYear: "2025",
    sourceAreaSqFt: null,
    checked: true,
    checkedAt: new Date().toISOString(),
  };
  assert.ok(footprintSchema.safeParse(p).success);
  assert.equal(
    footprintSchema.safeParse({ ...p, checked: false }).success,
    false,
  );
  const bad = structuredClone(p);
  bad.rings[0][1] = [NaN, 42];
  assert.equal(footprintSchema.safeParse(bad).success, false);
});
test("quick preplan requires first-in essentials but does not force the advanced survey", () => {
  const p = {
    ...blankPlan(),
    scope: "quick",
    name: "TEST ONLY",
    address: "200 Training Way",
    city: "Fictional City",
    region: "IL",
    addressConfirmed: true,
    entrance: "Unknown",
    hydrant: "Unknown",
    hydrantStatus: "Unknown",
    hazardStatus: "Unknown",
  };
  assert.deepEqual(blockers(p), []);
  assert.ok(blockers({ ...p, scope: "full" }).length >= 8);
  assert.ok(planSchema.safeParse(p).success);
});
test("deep detail entries persist separately and impaired systems produce explicit warnings", () => {
  const p = blankPlan();
  p.details = blankDetails();
  p.details.levels = [{ id: "floor-2", name: "Floor 2", notes: "TEST ONLY" }];
  p.details.firePump = {
    answer: "Yes",
    location: "TEST ONLY room",
    notes: "fixture",
    status: "Out of service",
  };
  assert.ok(planSchema.safeParse(p).success);
  assert.match(systemWarnings(p)[0], /Fire pump.*Out of service/);
  p.details.firePump.answer = "No";
  assert.deepEqual(systemWarnings(p), []);
});
