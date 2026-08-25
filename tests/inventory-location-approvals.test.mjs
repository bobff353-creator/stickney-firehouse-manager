import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const operations = await readFile(new URL("../app/inventory-operations.tsx", import.meta.url), "utf8");
const route = await readFile(new URL("../app/api/operations/route.ts", import.meta.url), "utf8");
const migration = await readFile(new URL("../supabase/migrations/20260825044346_add_inventory_location_change_approvals.sql", import.meta.url), "utf8");

test("crew location requests default to the equipment apparatus and its configured compartments", () => {
  assert.match(operations, /const apparatusId = equipment \? value\(equipment, "apparatus_id"\) : selectedApparatusId/);
  assert.match(operations, /"Wrong location"/);
  assert.match(operations, /Vehicle where item was found/);
  assert.match(operations, /Compartment where item was found/);
  assert.match(operations, /Currently assigned/);
  assert.match(operations, /Submit wrong location for approval/);
  assert.match(operations, /data\.compartments\.filter\(\(item\) => value\(item, "apparatus_id"\) === relocationApparatusId\)/);
  assert.match(operations, /request_location_change/);
  assert.match(operations, /Wrong location reported · awaiting administrator review/);
});

test("wrong-location controls are limited to inventory checks", () => {
  assert.match(operations, /const activeAllowsRelocation = activeCheckType === "inventory"/);
  assert.match(operations, /activeAllowsRelocation \? <button className="relocate"/);
  assert.match(operations, /relocationItem && activeCheck && activeAllowsRelocation/);
  assert.match(route, /\.eq\("check_type", "inventory"\)/);
});

test("administrator review can approve or deny a pending move", () => {
  assert.match(operations, /ADMIN · WRONG-LOCATION APPROVALS/);
  assert.match(operations, /Approve and move equipment/);
  assert.match(operations, /decision: "approved"/);
  assert.match(operations, /decision: "denied"/);
  assert.match(route, /action === "review_location_change"/);
  assert.match(route, /\.eq\("status", "pending"\)/);
});

test("approved requests atomically move equipment and reconcile active inventory checks", () => {
  assert.match(migration, /create trigger inventory_location_change_apply[\s\S]*before update/);
  assert.match(migration, /update public\.inventory_equipment[\s\S]*set apparatus_id = old\.proposed_apparatus_id/);
  assert.match(migration, /update public\.inventory_check_items as item[\s\S]*result = 'not_applicable'/);
  assert.match(migration, /insert into public\.inventory_check_items[\s\S]*on conflict \(check_id, equipment_id\) do nothing/);
  assert.match(migration, /raise exception 'The equipment location changed after this request was submitted/);
});

test("location request data is department-scoped and admin review is protected", () => {
  assert.match(migration, /alter table public\.inventory_location_change_requests enable row level security/);
  assert.match(migration, /requested_by = \(select auth\.uid\(\)\)/);
  assert.match(migration, /using \(private\.inventory_can_admin\(department_id\)\)/);
  assert.match(migration, /membership\.role in \('admin', 'chief'\)/);
  assert.match(migration, /inventory_location_change_one_pending_per_equipment_idx/);
});
