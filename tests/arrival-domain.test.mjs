import { test } from "node:test";
import assert from "node:assert/strict";
import {
  blankPlan,
  blockers,
  unknowns,
  planSchema,
  example,
  chicagoDate,
  systemKeys,
  answered,
} from "../app/arrival/lib/preplan.ts";
function complete() {
  const p = blankPlan();
  Object.assign(p, {
    name: "TEST ONLY",
    address: "100 Test Way",
    city: "Test City",
    region: "IL",
    addressConfirmed: true,
    occupancy: "Unknown",
    basement: "Unknown",
    entrance: "Unknown",
    hydrant: "Unknown",
    hydrantStatus: "Unknown",
    hazardStatus: "Unknown",
  });
  for (const k of systemKeys) p.systems[k].answer = "Unknown";
  return p;
}
test("blank plan does not treat missing observations as absent", () => {
  const p = blankPlan();
  assert.equal(p.hazardStatus, "");
  assert.ok(systemKeys.every((k) => p.systems[k].answer === ""));
  assert.ok(blockers(p).length >= 12);
  assert.equal(answered(p), 0);
});
test("explicit unknown answers can be reviewed and remain visible", () => {
  const p = complete();
  assert.deepEqual(blockers(p), []);
  const list = unknowns(p);
  for (const value of [
    "Construction",
    "Water supply",
    "Fire department connection (FDC)",
    "A-side photo",
    "Emergency contact",
  ])
    assert.ok(list.includes(value));
});
test("positive systems require a location or explicit Unknown location", () => {
  const p = complete();
  p.systems.fdc.answer = "Yes";
  assert.ok(
    blockers(p).some((x) =>
      x.text.includes("location of fire department connection"),
    ),
  );
  p.systems.fdc.location = "Unknown";
  assert.deepEqual(blockers(p), []);
  assert.ok(unknowns(p).includes("Fire department connection (FDC) location"));
});
test("None observed cannot contradict selected hazard tags", () => {
  const p = complete();
  p.hazardStatus = "None observed";
  p.hazards = ["Lightweight truss"];
  assert.ok(blockers(p).some((x) => x.text.includes("Hazard tags")));
});
test("present hazards need written locations", () => {
  const p = complete();
  p.hazardStatus = "Present";
  assert.ok(blockers(p).some((x) => x.text.includes("Describe the hazards")));
  p.hazardNotes = "TEST ONLY: roof truss, documentation pending";
  assert.deepEqual(blockers(p), []);
});
test("flow cannot be inferred and requires a positive value and valid historical test date", () => {
  const p = complete();
  p.flow = "-1";
  p.flowDate = "2026-02-31";
  assert.equal(blockers(p).filter((x) => x.step === 2).length, 2);
  p.flow = "1000";
  p.flowDate = chicagoDate();
  assert.deepEqual(blockers(p), []);
});
test("coordinates must be complete, finite and in geographic range", () => {
  const p = complete();
  for (const [lat, lng] of [
    ["90.1", "0"],
    ["0", "181"],
    ["NaN", "0"],
    ["1", ""],
  ]) {
    p.latitude = lat;
    p.longitude = lng;
    assert.ok(blockers(p).some((x) => x.text.includes("latitude")));
  }
  p.latitude = "0";
  p.longitude = "0";
  assert.deepEqual(blockers(p), []);
});
test("invalid dates and future visits do not pass review", () => {
  const p = complete();
  for (const date of ["2026-02-31", "2025-13-01", "2099-01-01"]) {
    p.visited = date;
    assert.ok(blockers(p).some((x) => x.text.includes("visit date")));
  }
});
test("floor count and review date are bounded", () => {
  const p = complete();
  p.floors = "2.5";
  p.reviewDue = "2020-01-01";
  assert.equal(blockers(p).filter((x) => [1, 5].includes(x.step)).length, 2);
});
test("schema rejects malformed statuses, oversized notes and invalid sketch coordinates", () => {
  const p = complete();
  assert.equal(
    planSchema.safeParse({ ...p, status: "published" }).success,
    true,
  );
  assert.equal(
    planSchema.safeParse({ ...p, hazardStatus: "Safe" }).success,
    false,
  );
  assert.equal(
    planSchema.safeParse({ ...p, notes: "x".repeat(4001) }).success,
    false,
  );
  assert.equal(
    planSchema.safeParse({
      ...p,
      pins: [{ id: "a", label: "FDC", x: 101, y: 10 }],
    }).success,
    false,
  );
});
test("snapshot edits do not mutate the published data", () => {
  const working = structuredClone(example.working);
  const published = structuredClone(working);
  working.systems.fdc.location = "TEST changed";
  assert.notEqual(working.systems.fdc.location, published.systems.fdc.location);
  assert.equal(example.id, "example");
});
