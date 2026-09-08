import assert from "node:assert/strict";
import test from "node:test";
import { fleetCheckShift, fleetChecksForShift } from "../app/fleet-check-shift.ts";
import { incompleteRequiredFleetChecks } from "../app/lib/fleet-projections.ts";

test("deadlines belong to the shift ending at the boundary", () => {
  for (const [time, shift] of [["06:00", "overnight"], ["06:01", "morning"], ["12:00", "morning"], ["12:01", "afternoon"], ["18:00", "afternoon"], ["18:01", "overnight"], ["00:00", "overnight"], ["03:30:00", "overnight"]]) {
    assert.equal(fleetCheckShift(time), shift, time);
  }
});
test("morning requirements do not block afternoon or overnight", () => {
  const checks = [{ id: "daily", endTime: "12:00" }, { id: "weekly", endTime: "17:00" }, { id: "night", endTime: "23:00" }];
  assert.deepEqual(fleetChecksForShift(checks, "morning").map(x => x.id), ["daily"]);
  assert.deepEqual(fleetChecksForShift(checks, "afternoon").map(x => x.id), ["weekly"]);
  assert.deepEqual(fleetChecksForShift(checks, "overnight").map(x => x.id), ["night"]);
});
test("invalid deadlines cannot be silently assigned to a shift", () => {
  for (const time of ["", "24:00", "12:60", "bad"]) assert.equal(fleetCheckShift(time), null);
});

test("Sunday log includes Monday early-morning requirements and their completion", async () => {
  const schedules = [
    { apparatus_id: "unit", check_type: "daily", day_of_week: 0, start_time: "06:00", end_time: "12:00" },
    { apparatus_id: "unit", check_type: "air_pack", day_of_week: 1, start_time: "00:00", end_time: "05:00" },
    { apparatus_id: "unit", check_type: "inventory", day_of_week: 0, start_time: "00:00", end_time: "05:00" },
    { apparatus_id: "unit", check_type: "weekly", day_of_week: 1, start_time: "06:00", end_time: "12:00" },
  ];
  const checks = [];
  const tables = { inventory_inspection_schedules: schedules, inventory_apparatus_profiles: [{ id: "unit", name: "1201" }], department_apparatus: [{ id: "unit", status: "in_service" }], inventory_checks: checks };
  const supabase = { from(table) {
    const query = { select() { return query; }, eq() { return query; }, in() { return query; }, order() { return query; }, limit() { return query; }, then(resolve) { return Promise.resolve({ data: tables[table], error: null }).then(resolve); } };
    return query;
  } };
  const pending = await incompleteRequiredFleetChecks(supabase, "department", "2026-09-06");
  assert.deepEqual(pending.map(x => x.checkType), ["daily", "air_pack"]);
  checks.push({ apparatus_id: "unit", check_type: "air_pack", status: "completed", completed_at: "2026-09-07T10:00:00Z" });
  const remaining = await incompleteRequiredFleetChecks(supabase, "department", "2026-09-06");
  assert.deepEqual(remaining.map(x => x.checkType), ["daily"]);
});
