import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { chicagoCalendarDate, chicagoWeekForDate, currentChicagoWeek, dailyFleetCheckUrgency } from "../app/lib/fleet-projections.ts";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("computes the current Fleet duty week in Chicago calendar dates", () => {
  const week = currentChicagoWeek();
  const start = new Date(`${week.start}T12:00:00Z`);
  const end = new Date(`${week.end}T12:00:00Z`);
  assert.equal(start.getUTCDay(), 1);
  assert.equal((end.getTime() - start.getTime()) / 86_400_000, 7);
  assert.match(chicagoCalendarDate(new Date()), /^\d{4}-\d{2}-\d{2}$/);
});

test("daily Fleet checks warn during the hour before the 7 AM due time", () => {
  assert.equal(dailyFleetCheckUrgency(5 * 60 + 59), "scheduled");
  assert.equal(dailyFleetCheckUrgency(6 * 60), "due_soon");
  assert.equal(dailyFleetCheckUrgency(6 * 60 + 59), "due_soon");
  assert.equal(dailyFleetCheckUrgency(7 * 60), "overdue");
});

test("resolves the scheduled weekly check window for the Daily Log date", () => {
  assert.deepEqual(chicagoWeekForDate("2026-08-03"), { start: "2026-08-03", end: "2026-08-10" });
  assert.deepEqual(chicagoWeekForDate("2026-08-09"), { start: "2026-08-03", end: "2026-08-10" });
});

test("links Fleet weekly due days to Duties, Daily Log, and Live Operations", async () => {
  const [duties, dailyDutyRoute, digitalTwinRoute, inventory, operations, logbook, dailyLog, dashboard, board] = await Promise.all([
    read("app/daily-duties.tsx"),
    read("app/api/daily-duties/route.ts"),
    read("app/api/digital-twin/route.ts"),
    read("app/inventory-live.tsx"),
    read("app/inventory-operations.tsx"),
    read("app/api/logbook/route.ts"),
    read("app/daily-log.tsx"),
    read("app/api/dashboard/route.ts"),
    read("app/operations-board.tsx"),
  ]);
  assert.match(duties, /check=weekly/);
  assert.match(duties, /Resume shared weekly check/);
  assert.match(duties, /Fleet weekly checks/);
  assert.match(digitalTwinRoute, /update_weekly_due_day/);
  assert.match(inventory, /Weekly check due day/);
  assert.match(inventory, /initialCheckType/);
  assert.match(operations, /start_check/);
  assert.match(operations, /requestedCheckOpenedRef/);
  assert.match(logbook, /completedApparatusChecksForDate/);
  assert.match(dailyLog, /Fleet &amp; Inventory Checks/);
  assert.match(dashboard, /openFleetEquipmentIssues/);
  assert.match(board, /board-duty-checks/);
  assert.match(board, /check=daily/);
  assert.match(board, /dailyChecksNeedAttention/);
  assert.match(board, /activeWeeklyChecks/);
  assert.match(board, /scheduled weekly vehicle checks are completed/);
  assert.match(dailyDutyRoute, /pendingDailyFleetChecks/);
});

test("blocks Officer Sign Out until required daily and scheduled weekly Fleet checks are complete", async () => {
  const [route, dailyLog, projections] = await Promise.all([
    read("app/api/logbook/route.ts"),
    read("app/daily-log.tsx"),
    read("app/lib/fleet-projections.ts"),
  ]);
  assert.match(route, /mode === "out"/);
  assert.match(route, /incompleteRequiredFleetChecks/);
  assert.match(route, /status: 409/);
  assert.match(route, /Fleet checklist status could not be verified/);
  assert.match(route, /fleetDutiesAcknowledged !== true/);
  assert.match(route, /fleet_duties_acknowledged = 1/);
  assert.match(dailyLog, /fleetRequirementsOnly=1/);
  assert.match(dailyLog, /Fleet checks required before sign out/);
  assert.match(dailyLog, /acceptedFleetDuties/);
  assert.match(dailyLog, /I acknowledge that all required Fleet checks and assigned duties/);
  assert.match(projections, /checkType: "weekly"/);
  assert.match(projections, /checkType: "daily"/);
  assert.match(projections, /weekly_due_day/);
});
