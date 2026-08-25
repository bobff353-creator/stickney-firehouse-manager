import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("apparatus maintenance history records labor, service, mileage, parts, and documents", async () => {
  const [operations, route, documents, migration] = await Promise.all([
    read("app/inventory-operations.tsx"),
    read("app/api/operations/route.ts"),
    read("app/api/operations/documents/route.ts"),
    read("supabase/migrations/20260825054617_add_apparatus_maintenance_documents_and_inspection_schedules.sql"),
  ]);
  for (const label of ["Permanent apparatus record", "Work performed by", "Labor", "Parts/materials", "Print service ticket", "Upload document"]) assert.match(operations, new RegExp(label, "i"));
  for (const field of ["service_type", "odometer", "labor_hours", "performed_by", "parts_used", "next_service_due_date", "next_service_due_mileage"]) assert.match(route, new RegExp(field));
  assert.match(documents, /inventory_work_order_documents/);
  assert.match(documents, /application\/pdf/);
  assert.match(migration, /create table if not exists public\.inventory_work_order_documents/);
  assert.match(migration, /private\.inventory_can_access\(department_id\)/);
});

test("admin inspection schedules feed duties, operations board, and officer sign-out", async () => {
  const [operations, route, projections, duties, board, logbook, migration] = await Promise.all([
    read("app/inventory-operations.tsx"),
    read("app/api/operations/route.ts"),
    read("app/lib/fleet-projections.ts"),
    read("app/daily-duties.tsx"),
    read("app/operations-board.tsx"),
    read("app/api/logbook/route.ts"),
    read("supabase/migrations/20260825054617_add_apparatus_maintenance_documents_and_inspection_schedules.sql"),
  ]);
  assert.match(operations, /Admin inspection scheduler/i);
  assert.match(operations, /Set required day and completion window/i);
  assert.match(route, /save_inspection_schedule/);
  assert.match(route, /delete_inspection_schedule/);
  assert.match(projections, /inventory_inspection_schedules/);
  assert.match(projections, /require_officer_signoff/);
  assert.match(duties, /Scheduled apparatus and inventory checks/);
  assert.match(board, /Scheduled apparatus checks/);
  assert.match(logbook, /incompleteRequiredFleetChecks/);
  assert.match(migration, /feeds_daily_duties boolean not null default true/);
  assert.match(migration, /feeds_operations_board boolean not null default true/);
  assert.match(migration, /require_officer_signoff boolean not null default true/);
});

test("schedule migration preserves existing daily and weekly obligations", async () => {
  const migration = await read("supabase/migrations/20260825054617_add_apparatus_maintenance_documents_and_inspection_schedules.sql");
  assert.match(migration, /generate_series\(0, 6\)/);
  assert.match(migration, /weekly_due_day is not null/);
  assert.match(migration, /on conflict \(department_id, apparatus_id, check_type, day_of_week\) do nothing/);
});
