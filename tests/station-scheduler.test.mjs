import assert from "node:assert/strict";
import test from "node:test";
import { readFile, access } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const missing = async (path) => {
  try { await access(new URL(path, import.meta.url)); return false; }
  catch { return true; }
};

test("the legacy scheduler UI is removed while its records API remains available", async () => {
  assert.equal(await missing("../app/scheduling.tsx"), true);
  assert.equal(await missing("../app/api/scheduling/route.ts"), false);
});

test("the Scheduling nav renders the new Station Scheduler", async () => {
  const app = await read("../app/payroll-app.tsx");
  assert.equal(app.includes('import StationScheduler from "./station-scheduler"'), true);
  assert.equal(app.includes('activeNav === "Scheduling" && <StationScheduler'), true);
});

test("station scheduler tables exist in schema and bootstrap", async () => {
  const [schema, bootstrap] = await Promise.all([read("../db/schema.ts"), read("../db/bootstrap.ts")]);
  for (const table of [
    "station_shift_types", "station_shift_type_roles", "station_schedule_entries", "station_shift_slots",
    "station_standing_assignments", "station_trade_requests", "station_shift_claims", "station_time_off_requests",
    "station_time_off_dates", "station_unavailability", "station_reminder_rules", "station_ot_settings",
    "station_ot_timing", "station_ot_interest", "station_ot_offers", "station_distribution_weights",
  ]) {
    assert.equal(bootstrap.includes(`CREATE TABLE IF NOT EXISTS ${table}`), true, `bootstrap creates ${table}`);
  }
  assert.equal(schema.includes('sqliteTable("station_shift_slots"'), true);
  assert.equal(bootstrap.includes("station-scheduler-v1"), true, "bootstrap version bumped for station tables");
  // Employee scheduler columns are added additively.
  assert.equal(bootstrap.includes("ADD COLUMN station_roles"), true);
  assert.equal(bootstrap.includes("ADD COLUMN station_ot_hours"), true);
});

test("consumers read filled station slots instead of legacy assignments", async () => {
  const [dept, logbook] = await Promise.all([read("../app/api/department-schedule/route.ts"), read("../app/api/logbook/route.ts")]);
  assert.equal(dept.includes("FROM station_shift_slots"), true);
  assert.equal(dept.includes("schedule_assignments"), false);
  assert.equal(logbook.includes("FROM station_shift_slots"), true);
  assert.equal(logbook.includes("schedule_assignments"), false);
});

test("OT logic exposes ranking, exemptions, award windows, and distribution", async () => {
  const logic = await read("../app/station-scheduler-logic.ts");
  assert.equal(logic.includes("export function rankByCriteria"), true);
  assert.equal(logic.includes("export function filterOtPool"), true);
  assert.equal(logic.includes("export function buildCallList"), true);
  assert.equal(logic.includes("export function classifyAward"), true);
  assert.equal(logic.includes("export function autoDistribute"), true);
  // Criteria comparators are all present.
  for (const criterion of ["leastOT", "leastMandatory", "mostSeniority", "leastSeniority"]) {
    assert.equal(logic.includes(criterion), true, `criterion ${criterion}`);
  }
  // Award window boundaries follow the spec.
  assert.equal(logic.includes('if (daysUntil > timing.awardDaysOut) return "early"'), true);
  assert.equal(logic.includes('if (daysUntil > timing.completeByDaysOut) return "award"'), true);
});

test("API route implements the full admin and employee action set", async () => {
  const route = await read("../app/api/station-scheduler/route.ts");
  for (const action of [
    "saveShiftType", "createEntry", "assignSlot", "saveStandingAssignment", "reviewClaim", "reviewTrade",
    "reviewTimeOff", "saveOtSettings", "saveOtTiming", "saveDistributionWeights", "runAutoDistribution",
    "buildOtCallList", "awardOtOffer", "saveReminderRule", "submitClaim", "submitTrade", "respondTrade",
    "submitTimeOff", "setOtInterest", "respondOtOffer", "saveMyNotifyPrefs",
  ]) {
    assert.equal(route.includes(`case "${action}"`), true, `action ${action}`);
  }
  // Identity comes from the platform auth header, like the rest of the app.
  assert.equal(route.includes('request.headers.get("oai-authenticated-user-email")'), true);
  // Time off approvers must be Officer/AO and dates must be the member's own scheduled days.
  assert.equal(route.includes("Choose an Officer/AO as the approver."), true);
  assert.equal(route.includes("not your scheduled shift days"), true);
});

test("standing assignments backfill open slots and time off writes unavailability", async () => {
  const route = await read("../app/api/station-scheduler/route.ts");
  assert.equal(route.includes("UPDATE station_shift_slots SET employee_id=?,status='filled' WHERE status='open' AND role=?"), true);
  assert.equal(route.includes("INSERT INTO station_unavailability"), true);
});
