import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { apparatusCheckRequired, chicagoCalendarDate, chicagoWeekForDate, currentChicagoWeek, dailyFleetCheckUrgency } from "../app/lib/fleet-projections.ts";

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

test("Out of Service apparatus are exempt from daily and weekly checks only", () => {
  assert.equal(apparatusCheckRequired("out_of_service", "daily"), false);
  assert.equal(apparatusCheckRequired("Out Of Service", "weekly"), false);
  assert.equal(apparatusCheckRequired("out-of-service", "inventory"), true);
  assert.equal(apparatusCheckRequired("out_of_service", "air_pack"), true);
  assert.equal(apparatusCheckRequired("in_service", "daily"), true);
  assert.equal(apparatusCheckRequired("impaired", "weekly"), true);
});

test("the Out of Service exemption is enforced and explained across Fleet workflows", async () => {
  const [projections, operationsRoute, inventory, operations, duties] = await Promise.all([
    read("app/lib/fleet-projections.ts"),
    read("app/api/operations/route.ts"),
    read("app/inventory-live.tsx"),
    read("app/inventory-operations.tsx"),
    read("app/daily-duties.tsx"),
  ]);
  assert.match(projections, /department_apparatus/);
  assert.match(projections, /apparatusCheckRequired\(fleetStatuses\.get\(vehicle\.id\), checkType\)/);
  assert.match(operationsRoute, /fleetApparatus\?\.status === "out_of_service"/);
  assert.match(operationsRoute, /Daily and weekly checks resume when Fleet returns it to service/);
  assert.match(inventory, /Daily and weekly checks: Not needed/);
  assert.match(inventory, /will not appear overdue or block officer sign-out/);
  assert.match(operations, /Not needed — apparatus Out of Service/);
  assert.match(duties, /Not needed — apparatus out of service/);
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
  assert.match(duties, /check=\$\{encodeURIComponent\(check\.checkType\)\}/);
  assert.match(duties, /Resume shared check/);
  assert.match(duties, /Scheduled apparatus and inventory checks/);
  assert.match(digitalTwinRoute, /update_weekly_due_day/);
  assert.match(inventory, /Weekly check due day/);
  assert.match(inventory, /initialCheckType/);
  assert.match(operations, /start_check/);
  assert.match(operations, /requestedCheckOpenedRef/);
  assert.match(logbook, /completedApparatusChecksForDate/);
  assert.match(dailyLog, /Fleet &amp; Inventory Checks/);
  assert.match(dashboard, /openFleetEquipmentIssues/);
  assert.match(board, /board-duty-checks/);
  assert.match(board, /check=\$\{encodeURIComponent\(check\.checkType\)\}/);
  assert.match(board, /dailyChecksNeedAttention/);
  assert.match(board, /dailyFleetChecks/);
  assert.match(board, /scheduled checks are completed/);
  assert.match(dailyDutyRoute, /pendingDailyFleetChecks/);
});

test("blocks Officer Sign Out until required daily and scheduled weekly Fleet checks are complete", async () => {
  const [route, dailyLog, projections, migration, styles] = await Promise.all([
    read("app/api/logbook/route.ts"),
    read("app/daily-log.tsx"),
    read("app/lib/fleet-projections.ts"),
    read("supabase/migrations/20260805112045_add_fleet_duties_acknowledgement.sql"),
    read("app/globals.css"),
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
  assert.match(dailyLog, /I acknowledge that all required Fleet checks and assigned\s+duties/);
  assert.match(projections, /inventory_inspection_schedules/);
  assert.match(projections, /require_officer_signoff/);
  assert.match(projections, /scheduledCheckCompleted/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS fleet_duties_acknowledged integer NOT NULL DEFAULT 0/);
  assert.match(styles, /Daily Log uses a dark phone workspace/);
  assert.match(styles, /\.officer-actions button:disabled\{[^}]*opacity:\.78/);
});
