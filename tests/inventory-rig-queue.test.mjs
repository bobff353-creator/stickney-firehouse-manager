import assert from "node:assert/strict";
import test from "node:test";
import { rigQueue } from "../app/inventory-rig-queue.ts";
import { incompleteRequiredFleetChecks, pendingDailyFleetChecks } from "../app/lib/fleet-projections.ts";

const now = new Date("2026-11-21T15:00:00Z");
const rig = { id: "engine", name: "Engine", status: "in_service" };
const reserve = { id: "reserve", name: "Reserve", status: "out_of_service" };
const schedule = (apparatus_id, check_type, day_of_week = 6) => ({
  apparatus_id, check_type, day_of_week, active: true,
  start_time: "06:00", end_time: "12:00",
  feeds_operations_board: true, require_officer_signoff: true,
});
const records = {
  apparatus: [rig, reserve],
  equipment: [{ id: "radio", apparatus_id: rig.id, check_types: ["daily", "weekly", "inventory"] }],
  inspectionSchedules: [schedule(rig.id, "daily"), schedule(rig.id, "weekly"), schedule(reserve.id, "daily"), schedule(rig.id, "drug", 0)],
  checks: [
    { id: "daily", apparatus_id: rig.id, check_type: "daily", status: "in_progress", started_at: "2026-11-20T14:00:00Z" },
    { id: "weekly", apparatus_id: rig.id, check_type: "weekly", status: "completed", completed_at: "2026-11-16T06:30:00Z", review_status: "pending" },
    { id: "count", apparatus_id: rig.id, check_type: "inventory", status: "in_progress" },
  ],
  checkItems: [{ check_id: "daily", result: "pass" }, { check_id: "daily", result: "pending" }],
  scbaTemplates: [], scbaEntries: [],
};

function mockSupabase(data) {
  const tables = {
    inventory_inspection_schedules: data.inspectionSchedules,
    inventory_apparatus_profiles: data.apparatus,
    department_apparatus: data.apparatus,
    inventory_checks: data.checks,
  };
  return { from(table) {
    let rows = tables[table];
    const query = {
      select: () => query,
      eq(key, value) { if (key !== "department_id") rows = rows.filter(row => row[key] === value); return query; },
      in(key, list) { rows = rows.filter(row => list.includes(row[key])); return query; },
      order: () => query,
      limit: () => query,
      then(resolve) { resolve({ data: rows, error: null }); },
    };
    return query;
  } };
}

test("same completion and service exemptions as officer sign-out and Live Operations", async () => {
  const queue = rigQueue(records, rig.id, now);
  const board = await pendingDailyFleetChecks(mockSupabase(records), "test", "2026-11-21");
  const required = await incompleteRequiredFleetChecks(mockSupabase(records), "test", "2026-11-21");
  assert.deepEqual(queue.due.map(job => job.type), board.map(job => job.checkType));
  assert.deepEqual(queue.due.filter(job => job.signOutRequired).map(job => job.type), required.map(job => job.checkType));
  assert.deepEqual(queue.due.map(job => [job.activeId, job.total, job.pending]), [["daily", 2, 1]]);
  assert.deepEqual(queue.unfinished.map(job => job.activeId), ["count"]);
  assert.deepEqual(rigQueue(records, reserve.id, now).exempt, ["daily"]);
});

test("a scheduled sign-out requirement without a template stays visible", () => {
  const { due } = rigQueue({ ...records, equipment: [], checks: [] }, rig.id, now);
  assert.deepEqual(due.map(job => [job.type, job.configured, job.signOutRequired]), [["daily", 0, true], ["weekly", 0, true]]);
  assert.deepEqual(rigQueue(records, "unknown-unit", now).due, []);
});
