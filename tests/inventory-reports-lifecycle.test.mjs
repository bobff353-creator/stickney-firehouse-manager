import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const shell = await readFile(new URL("../app/inventory-live.tsx", import.meta.url), "utf8");
const operations = await readFile(new URL("../app/inventory-operations.tsx", import.meta.url), "utf8");
const route = await readFile(new URL("../app/api/operations/route.ts", import.meta.url), "utf8");
const migration = await readFile(new URL("../supabase/migrations/20260825052518_add_inventory_asset_lifecycle_and_check_reviews.sql", import.meta.url), "utf8");

test("equipment directory supports search, apparatus filtering, and sorting", () => {
  assert.match(operations, /Search equipment/);
  assert.match(operations, /All apparatus/);
  assert.match(operations, /Rig and compartment/);
  assert.match(operations, /equipmentRigFilter/);
  assert.match(operations, /equipmentSort/);
});

test("administrators can manage complete asset lifecycle and grouping", () => {
  for (const label of ["Item / grouping type", "Contained in kit, bag, or tool box", "Purchase date", "Placed in service", "Expiration date", "Check response", "Service status", "Retirement reason"]) {
    assert.match(operations, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(operations, /Create repair ticket/);
  assert.match(operations, /Place out of service/);
  assert.match(route, /action === "set_equipment_status"/);
  assert.match(route, /equipment_id: equipmentId/);
});

test("reports tab prints, prepares email, and exposes check approval queue", () => {
  assert.match(shell, /\["reports", "Reports"\]/);
  assert.match(operations, /Completed checks awaiting review/);
  assert.match(operations, /Approve check/);
  assert.match(operations, /Request changes/);
  assert.match(operations, /window\.print\(\)/);
  assert.match(operations, /mailto:/);
  assert.match(route, /action === "review_check"/);
  assert.match(route, /review_status: "pending"/);
});

test("migration preserves legacy history and adds bounded lifecycle and review fields", () => {
  assert.match(migration, /add column if not exists parent_equipment_id uuid/);
  assert.match(migration, /add column if not exists response_type text/);
  assert.match(migration, /add column if not exists service_status text/);
  assert.match(migration, /add column if not exists review_status text not null default 'approved'/);
  assert.match(migration, /alter column review_status set default 'pending'/);
  assert.match(migration, /inventory_checks_review_queue_idx/);
  assert.doesNotMatch(migration, /delete from|drop table/i);
});
