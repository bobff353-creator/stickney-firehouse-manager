import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { next24DepartmentSchedule, scheduledStaffingForLog } from "../app/department-schedule.ts";

const assignment = {
  id: "shift-1",
  employeeId: "employee-1",
  employeeName: "Delgatto, Eric",
  workDate: "2026-07-26",
  startTime: "06:00",
  endTime: "06:00",
  role: "Firefighter",
  source: "rotation",
  status: "assigned",
};

test("a 24-hour department assignment fills all three editable Daily Log sections", () => {
  assert.deepEqual(scheduledStaffingForLog([assignment], "2026-07-26").map((row) => ({
    shiftKey: row.shiftKey,
    employeeId: row.employeeId,
    timeIn: row.timeIn,
    timeOut: row.timeOut,
  })), [
    { shiftKey: "morning", employeeId: "employee-1", timeIn: "06:00", timeOut: "12:00" },
    { shiftKey: "afternoon", employeeId: "employee-1", timeIn: "12:00", timeOut: "18:00" },
    { shiftKey: "overnight", employeeId: "employee-1", timeIn: "18:00", timeOut: "06:00" },
  ]);
});

test("an assignment beginning after midnight fills the prior operational day's overnight section", () => {
  const rows = scheduledStaffingForLog([{
    ...assignment,
    id: "shift-2",
    workDate: "2026-07-27",
    startTime: "00:00",
    endTime: "06:00",
  }], "2026-07-26");
  assert.equal(rows.length, 1);
  assert.deepEqual({ shiftKey: rows[0].shiftKey, timeIn: rows[0].timeIn, timeOut: rows[0].timeOut }, {
    shiftKey: "overnight",
    timeIn: "00:00",
    timeOut: "06:00",
  });
});

test("schedule prefill never automatically selects Acting Officer payroll", () => {
  const rows = scheduledStaffingForLog([{
    ...assignment,
    role: "Officer/AO",
  }], "2026-07-26");
  assert.equal(rows.length, 3);
  assert.equal(rows.every((row) => row.actingOfficer === false), true);
});

test("Next 24 Hours uses only assigned department shifts that overlap the live window", () => {
  const items = next24DepartmentSchedule([
    assignment,
    { ...assignment, id: "future", employeeId: "employee-2", workDate: "2026-07-27", startTime: "12:00", endTime: "18:00" },
    { ...assignment, id: "open", employeeId: null, workDate: "2026-07-27", startTime: "06:00", endTime: "12:00", status: "open" },
  ], "2026-07-26", 720);
  assert.deepEqual(items.map((item) => item.id), ["shift-1"]);
  assert.equal(items[0].endDate, "2026-07-27");
});

test("Live Operations prefers saved Daily Log staffing and falls back to the active built schedule", async () => {
  const source = await readFile(new URL("../app/api/dashboard/route.ts", import.meta.url), "utf8");
  assert.match(source, /let onDuty = staffing\.results/);
  assert.match(source, /if \(!onDuty\.length\)/);
  assert.match(source, /scheduledStaffingForLog\(scheduled\.results, now\.date\)/);
  assert.match(source, /row\.shiftKey !== currentShift/);
  assert.match(source, /uniqueScheduledStaffing\.has\(row\.employeeId\)/);
  assert.match(source, /t\.active = 1/);
  assert.match(source, /e\.active = 1/);
  assert.match(source, /onDuty,/);
  assert.match(source, /filled: onDuty\.length/);
});
