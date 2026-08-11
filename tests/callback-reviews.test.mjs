import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { employeeWasOnDutyAtCall, militaryMinutes } from "../app/callback-duty.ts";
import {
  callbackSuggestedHours,
  callbackTypeMatch,
  evaluateCallbackRules,
} from "../app/callback-rules.ts";

test("callback duty validation handles daytime and overnight staffing", () => {
  assert.equal(militaryMinutes("17:34"), 17 * 60 + 34);
  assert.equal(militaryMinutes("0708"), 7 * 60 + 8);
  assert.equal(employeeWasOnDutyAtCall({ employeeId: "one", timeIn: "06:00", timeOut: "12:00" }, "0708"), true);
  assert.equal(employeeWasOnDutyAtCall({ employeeId: "one", timeIn: "12:00", timeOut: "18:00" }, "0708"), false);
  assert.equal(employeeWasOnDutyAtCall({ employeeId: "one", timeIn: "18:00", timeOut: "06:00" }, "0130"), true);
  assert.equal(employeeWasOnDutyAtCall({ employeeId: null, timeIn: "18:00", timeOut: "06:00" }, "0130"), false);
});

test("callback rules cover weekend, holiday, call type, back-to-back, hours, and approval flags", () => {
  const call = { id: "call-1", logDate: "2026-08-07", timeOut: "18:00", timeIn: "20:01", callType: "MVA" };
  const evaluation = evaluateCallbackRules({
    call,
    holidayName: "Department holiday",
    otherCalls: [{ ...call, id: "call-2", timeOut: "18:05" }],
    employeeOnDuty: true,
    employeeCallbackCalls: [{ ...call, id: "call-3", timeOut: "19:00" }],
  });
  assert.equal(evaluation.suggestedHours, 2.25);
  assert.equal(evaluation.matches.some((match) => match.startsWith("Weekend window")), true);
  assert.equal(evaluation.matches.some((match) => match.startsWith("Department holiday")), true);
  assert.equal(evaluation.matches.some((match) => match.includes("Auto accident")), true);
  assert.equal(evaluation.matches.some((match) => match.startsWith("Back-to-back")), true);
  assert.equal(evaluation.flags.some((flag) => flag.includes("already on duty")), true);
  assert.equal(evaluation.flags.some((flag) => flag.includes("double callback")), true);
  assert.equal(callbackSuggestedHours("18:00", ""), 2);
  assert.equal(callbackTypeMatch("AUTOMATIC FIRE ALARM"), "Fire alarm");
  assert.equal(callbackTypeMatch("Mutual Aid to Berwyn"), "Mutual aid");
});

test("callback rules use a red approval flag instead of automatic denial", () => {
  const evaluation = evaluateCallbackRules({ call: { id: "ordinary", logDate: "2026-08-10", timeOut: "10:00", timeIn: "10:30", callType: "EMS" } });
  assert.equal(evaluation.automaticallyQualifies, false);
  assert.equal(evaluation.flags.some((flag) => flag.includes("No automatic callback condition")), true);
});

test("callback API enforces permissions, reviewer ownership, and posts approved hours", async () => {
  const source = await readFile(new URL("../app/api/callbacks/route.ts", import.meta.url), "utf8");
  assert.match(source, /hasPermission\(request, db, "daily_log\.manage"\)/);
  assert.match(source, /hasPermission\(request, db, "payroll\.manage"\)/);
  assert.match(source, /hasPermission\(request, db, "permissions\.manage"\)/);
  assert.match(source, /employeeWasOnDutyAtCall/);
  assert.match(source, /isDeputyChief/);
  assert.match(source, /callback_payroll_aggregates/);
  assert.match(source, /Approve or Deny/);
  assert.match(source, /category='callback'/);
});

test("Daily Log and Payroll expose callback submission and review", async () => {
  const [dailyLog, payroll] = await Promise.all([
    readFile(new URL("../app/daily-log.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/payroll-app.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(dailyLog, /Callback attendance/);
  assert.match(dailyLog, /Active members who were not already on duty/);
  assert.match(dailyLog, /No off-duty active members are available/);
  assert.match(payroll, /Callback Reviews/);
  assert.match(payroll, /<CallbackReviews/);
});

test("callback API excludes employees who were on duty at the call time", async () => {
  const source = await readFile(new URL("../app/api/callbacks/route.ts", import.meta.url), "utf8");
  assert.match(source, /\.filter\(\(employee\) => !employee\.onDuty\)/);
});

test("callback submission binds one value for every insert placeholder", async () => {
  const source = await readFile(new URL("../app/api/callbacks/route.ts", import.meta.url), "utf8");
  const insert = source.match(/db\.prepare\("(INSERT INTO daily_log_callback_submissions[^"]+)"\)\.bind/);
  assert.ok(insert, "callback insert query must remain discoverable");
  assert.equal((insert[1].match(/\?/g) ?? []).length, 17);
});

test("callback migration preserves calls and seeds the verified reviewer", async () => {
  const source = await readFile(new URL("../supabase/migrations/20260811002824_add_daily_log_callback_reviews.sql", import.meta.url), "utf8");
  assert.match(source, /daily_log_callback_submissions/);
  assert.match(source, /unique\(call_id, employee_id\)/);
  assert.match(source, /where e\.id='wyant-robert'/);
  assert.doesNotMatch(source, /call_id text[^\n]+references firehouse\.daily_log_calls/);
});

test("callback rule migration preserves manual payroll and stores explainable snapshots", async () => {
  const source = await readFile(new URL("../supabase/migrations/20260811013542_add_callback_rule_evaluations.sql", import.meta.url), "utf8");
  assert.match(source, /rule_matches text/);
  assert.match(source, /rule_flags text/);
  assert.match(source, /suggested_hours double precision/);
  assert.match(source, /callback_payroll_aggregates/);
  assert.match(source, /manual_baseline_hours/);
  assert.match(source, /enable row level security/);
});
