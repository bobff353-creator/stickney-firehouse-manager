import assert from "node:assert/strict";
import test from "node:test";
import { dailyLogPayrollEntries, dailyLogPayrollTotals, workedHours } from "../app/payroll-hours.ts";

test("same start and end time is a 24-hour tour", () => {
  assert.equal(workedHours("06:00", "06:00"), 24);
});

test("overnight and partial tours calculate correctly", () => {
  assert.equal(workedHours("18:00", "06:00"), 12);
  assert.equal(workedHours("06:00", "12:00"), 6);
  assert.equal(workedHours("bad", "06:00"), 0);
});

test("only employees actually present in the Daily Log receive hours", () => {
  const totals = dailyLogPayrollTotals([
    { employeeId: "delgatto-eric", timeIn: "06:00", timeOut: "06:00", shiftKey: "morning" },
  ], null);
  assert.equal(totals.get("delgatto-eric")?.shift, 24);
  assert.equal(totals.has("czech-doug"), false);
});

test("multiple valid categories may exceed 24 hours without changing log totals", () => {
  const totals = dailyLogPayrollTotals([
    { employeeId: "employee-1", timeIn: "06:00", timeOut: "06:00", shiftKey: "morning" },
    { employeeId: "employee-1", timeIn: "06:00", timeOut: "12:00", shiftKey: "morning", actingOfficer: true },
  ], null);
  assert.deepEqual(totals.get("employee-1"), { shift: 30, holiday: 0, actingOfficer: 6 });
});

test("automatic DPW time uses its own category and never creates ghost employees", () => {
  const totals = dailyLogPayrollTotals([
    { employeeId: "dpw-employee", timeIn: "06:00", timeOut: "12:00", shiftKey: "morning" },
  ], null);
  assert.deepEqual(dailyLogPayrollEntries(totals, new Set(["dpw-employee", "czech-doug"])), [
    { employeeId: "dpw-employee", category: "dailyLogDpw", hours: 6 },
  ]);
});
