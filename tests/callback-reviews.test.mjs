import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { employeeWasOnDutyAtCall, militaryMinutes } from "../app/callback-duty.ts";

test("callback duty validation handles daytime and overnight staffing", () => {
  assert.equal(militaryMinutes("17:34"), 17 * 60 + 34);
  assert.equal(militaryMinutes("0708"), 7 * 60 + 8);
  assert.equal(employeeWasOnDutyAtCall({ employeeId: "one", timeIn: "06:00", timeOut: "12:00" }, "0708"), true);
  assert.equal(employeeWasOnDutyAtCall({ employeeId: "one", timeIn: "12:00", timeOut: "18:00" }, "0708"), false);
  assert.equal(employeeWasOnDutyAtCall({ employeeId: "one", timeIn: "18:00", timeOut: "06:00" }, "0130"), true);
  assert.equal(employeeWasOnDutyAtCall({ employeeId: null, timeIn: "18:00", timeOut: "06:00" }, "0130"), false);
});

test("callback API enforces permissions and on-duty membership", async () => {
  const source = await readFile(new URL("../app/api/callbacks/route.ts", import.meta.url), "utf8");
  assert.match(source, /hasPermission\(request, db, "daily_log\.manage"\)/);
  assert.match(source, /hasPermission\(request, db, "payroll\.manage"\)/);
  assert.match(source, /hasPermission\(request, db, "permissions\.manage"\)/);
  assert.match(source, /employeeWasOnDutyAtCall/);
  assert.match(source, /were not on duty when this call was generated/);
});

test("Daily Log and Payroll expose callback submission and review", async () => {
  const [dailyLog, payroll] = await Promise.all([
    readFile(new URL("../app/daily-log.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/payroll-app.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(dailyLog, /Callback attendance/);
  assert.match(dailyLog, /Only members on duty/);
  assert.match(payroll, /Callback Reviews/);
  assert.match(payroll, /<CallbackReviews/);
});

test("callback migration preserves calls and seeds the verified reviewer", async () => {
  const source = await readFile(new URL("../supabase/migrations/20260811002824_add_daily_log_callback_reviews.sql", import.meta.url), "utf8");
  assert.match(source, /daily_log_callback_submissions/);
  assert.match(source, /unique\(call_id, employee_id\)/);
  assert.match(source, /where e\.id='wyant-robert'/);
  assert.doesNotMatch(source, /call_id text[^\n]+references firehouse\.daily_log_calls/);
});
