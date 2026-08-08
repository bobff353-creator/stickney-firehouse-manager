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
  assert.equal(bootstrap.includes("station-scheduler-v2"), true, "bootstrap version bumped for shift recurrence");
  // Employee scheduler columns are added additively.
  assert.equal(bootstrap.includes("ADD COLUMN station_roles"), true);
  assert.equal(bootstrap.includes("ADD COLUMN station_ot_hours"), true);
});

test("scheduler uses the scoped Stickney mobile workspace instead of prototype branding", async () => {
  const [component, styles] = await Promise.all([
    read("../app/station-scheduler.tsx"),
    read("../app/globals.css"),
  ]);

  assert.equal(component.includes("Stickney Scheduler"), true);
  assert.equal(component.includes("Station 14"), false);
  for (const label of ["Calendar", "Shift Builder", "Roster & Assignments", "Trades", "Requests", "Auto-Distribution", "Overtime", "Time Off", "Reminders"]) {
    assert.equal(component.includes(`\"${label}\"`), true, `${label} remains available`);
  }
  assert.equal(component.includes("scheduler-month"), true);
  assert.equal(component.includes("shift-type-card"), true);
  assert.equal(component.includes('Start (24-hour)'), true);
  assert.equal(component.includes('First shift day'), true);
  assert.equal(component.includes('Repeat every'), true);
  assert.equal(component.includes('inputMode="numeric"'), true);
  assert.equal(component.includes('disabled={busy} onClick={save}'), true, "save remains clickable so validation can explain missing fields");
  assert.equal(styles.includes("Stickney Station Scheduler - deliberately scoped"), true);
  assert.equal(styles.includes(".scheduler-month"), true);
  assert.equal(component.includes("12_000"), true, "calendar rotates each day's visible shift every 12 seconds");
  assert.equal(component.includes("calendar-shift-summary"), true, "calendar shows the active shift and its staffing");
  assert.equal(component.includes('slot.status === "open" ? "OPEN"'), true, "calendar labels open roles clearly");
  assert.equal(component.includes("Pause rotation"), true, "automatic rotation can be paused");
  assert.equal(component.includes("datesWithActiveBuiltShifts"), true, "active Shift Builder entries take priority over retired imported overlaps");
  assert.equal(component.includes('"--calendar-shift-color"'), true, "calendar days inherit their saved Shift Builder color");
  assert.equal(styles.includes("button.calendar-has-shift"), true, "the saved shift color is visible across the day card");
  assert.equal(styles.includes(".workspace:has(.scheduler)"), true, "scheduler uses the available workspace width");
  assert.equal(styles.includes("@media (max-width: 390px)"), true);
});

test("production migrations install the scheduler before runtime bootstrap", async () => {
  const [schemaMigration, markerMigration] = await Promise.all([
    read("../supabase/migrations/20260807144541_add_station_scheduler_schema.sql"),
    read("../supabase/migrations/20260807144707_mark_station_scheduler_bootstrap_ready.sql"),
  ]);

  for (const table of [
    "station_shift_types", "station_schedule_entries", "station_shift_slots",
    "station_trade_requests", "station_time_off_requests", "station_ot_offers",
  ]) {
    assert.equal(schemaMigration.includes(`create table if not exists firehouse.${table}`), true);
    assert.equal(schemaMigration.includes(`alter table firehouse.${table} enable row level security`), true);
  }

  assert.equal(schemaMigration.includes("from firehouse.schedule_assignments"), true);
  assert.equal(schemaMigration.includes("on conflict (id) do nothing"), true);
  assert.equal(markerMigration.includes("stickney-runtime-bootstrap-2026-08-07-station-scheduler-v1"), true);
});

test("shift patterns are durable and generate recurring calendar entries without duplicates", async () => {
  const [route, schema, bootstrap, migration] = await Promise.all([
    read("../app/api/station-scheduler/route.ts"),
    read("../db/schema.ts"),
    read("../db/bootstrap.ts"),
    read("../supabase/migrations/20260807163537_add_station_shift_recurrence.sql"),
  ]);
  for (const source of [schema, bootstrap, migration]) {
    assert.equal(source.includes("anchor_date"), true);
    assert.equal(source.includes("repeat_every_days"), true);
  }
  assert.equal(route.includes("recurringShiftDates(anchorDate, repeatEveryDays"), true);
  assert.equal(route.includes("existing.has(entryDate)"), true);
  assert.equal(route.includes("recurring shift dates added"), true);
  assert.equal(migration.includes("between 0 and 365"), true);
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
  assert.equal(logic.includes("export function recurringShiftDates"), true);
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

test("scheduler date range casts stored text dates before Postgres comparison", async () => {
  const route = await read("../app/api/station-scheduler/route.ts");

  assert.equal(route.includes("WHERE date(entry_date)>=date(?, '-45 day')"), true);
  assert.equal(route.includes("WHERE date(en.entry_date)>=date(?, '-45 day')"), true);
  assert.equal(route.includes("WHERE entry_date>=date(?, '-45 day')"), false);
  assert.equal(route.includes("WHERE en.entry_date>=date(?, '-45 day')"), false);
});

test("standing assignments synchronize future slots while preserving schedule history", async () => {
  const route = await read("../app/api/station-scheduler/route.ts");
  assert.equal(route.includes("status='open' OR employee_id IN (SELECT employee_id FROM station_standing_assignments"), true, "a new standing assignment replaces a removed member in generated future slots");
  assert.equal(route.includes("That standing assignment is no longer active."), true);
  assert.equal(route.includes("SELECT employee_id employeeId FROM station_standing_assignments WHERE shift_type_id=? AND role=? AND active=1 ORDER BY created_at DESC LIMIT 1"), true, "removing a standing assignment selects the current replacement");
  assert.equal(route.includes("WHERE employee_id=? AND role=? AND entry_id IN (SELECT id FROM station_schedule_entries WHERE shift_type_id=? AND entry_date>=?)"), true, "only matching future occurrences are synchronized");
  assert.equal(route.includes("INSERT INTO station_unavailability"), true);
});

test("employees with a Last Day are excluded from every active scheduling path", async () => {
  const route = await read("../app/api/station-scheduler/route.ts");

  assert.equal(route.includes("WHERE e.active=1 AND COALESCE(TRIM(ep.end_date),'')='' ORDER BY e.name COLLATE NOCASE"), true);
  assert.equal(route.includes("async function isSchedulableEmployee"), true);
  assert.equal(route.includes("That employee has a Last Day and is no longer available for scheduling."), true);
  assert.equal(route.includes("sa.active=1 AND e.active=1 AND COALESCE(TRIM(ep.end_date),'')=''"), true);
  assert.equal(route.includes("WHERE sa.shift_type_id=? AND sa.active=1 AND e.active=1 AND COALESCE(TRIM(ep.end_date),'')=''"), true);
});
