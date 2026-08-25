import assert from "node:assert/strict";
import test from "node:test";
import { buildPayrollDetails, buildStaffingDetails } from "../app/command-center-analytics.ts";

test("staffing detail includes weekday-ready shift times and applicable holidays", () => {
  const rows = buildStaffingDetails([
    { date: "2026-07-04", shiftKey: "morning", filled: 2 },
    { date: "2026-12-24", shiftKey: "morning", filled: 4 },
    { date: "2026-12-24", shiftKey: "overnight", filled: 3 },
  ]);

  assert.equal(rows[0].timeRange, "06:00–12:00");
  assert.equal(rows[0].gaps, 2);
  assert.ok(rows[0].holidayName);
  assert.equal(rows[1].holidayName, null, "Christmas Eve only applies to the overnight shift");
  assert.ok(rows[2].holidayName);
});

test("payroll detail uses effective rates, 106-hour overtime, DPW, and AO stipend", () => {
  const base = { employeeId: "employee-1", periodStart: "2026-07-26", rank: "Firefighter", payScaleId: "ff", overtimeRate: 30, holidayRate: 40 };
  const rows = buildPayrollDetails([
    { ...base, date: "2026-07-26", category: "shift", hours: 100, regularRate: 20 },
    { ...base, date: "2026-08-01", category: "callback", hours: 10, regularRate: 20 },
    { ...base, date: "2026-08-02", category: "dailyLogDpw", hours: 2, regularRate: 20 },
    { ...base, date: "2026-08-03", category: "actingOfficer", hours: 6, regularRate: 20 },
    { ...base, date: "2026-08-04", category: "workDetail", hours: 4, regularRate: 20 },
  ], [
    { payScaleId: "ff", effectiveDate: "1900-01-01", regularRate: 20, overtimeRate: 30, holidayRate: 40 },
    { payScaleId: "ff", effectiveDate: "2026-08-01", regularRate: 30, overtimeRate: 45, holidayRate: 60 },
  ], { overtimeThreshold: 106, actingOfficerPremium: 1, dpwMultiplier: 1.5 });

  assert.equal(rows[1].overtimeHours, 4);
  assert.equal(rows[1].cost, 360);
  assert.equal(rows[2].category, "dpw");
  assert.equal(rows[2].cost, 90);
  assert.equal(rows[3].cost, 6);
  assert.equal(rows[4].cost, 180);
  assert.equal(rows[4].overtimeHours, 0, "Work Detail premium does not inflate displayed overtime hours");
});
