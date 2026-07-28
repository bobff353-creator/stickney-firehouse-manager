import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { completedDispatchReportNumbers } from "../app/dispatch-closure.ts";

test("only calls with a report number and Time In close active dispatches", () => {
  assert.deepEqual(completedDispatchReportNumbers([
    { reportNumber: "STIF-100", timeIn: "0915" },
    { reportNumber: "STIF-101", timeIn: "" },
    { reportNumber: "", timeIn: "0920" },
    { reportNumber: " STIF-100 ", timeIn: "0915" },
  ]), ["STIF-100"]);
});

test("Daily Log saves and dashboard refreshes clear matching active dispatches", async () => {
  const [logbook, dashboard] = await Promise.all([
    readFile(new URL("../app/api/logbook/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/dashboard/route.ts", import.meta.url), "utf8"),
  ]);
  assert.equal(logbook.includes("completedDispatchReportNumbers(calls)"), true);
  assert.equal(logbook.includes("SET active = 0, cleared_at = COALESCE(cleared_at, CURRENT_TIMESTAMP)"), true);
  assert.equal(dashboard.includes("trim(daily_log_calls.time_in) <> ''"), true);
});
