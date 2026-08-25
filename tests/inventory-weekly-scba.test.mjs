import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("weekly SCBA checks use editable rig templates and structured crew entries", async () => {
  const [operations, route, styles] = await Promise.all([
    read("app/inventory-operations.tsx"),
    read("app/api/operations/route.ts"),
    read("app/inventory/inventory.css"),
  ]);

  for (const label of [
    "WEEKLY AIR PACK TEMPLATE",
    "SCBA pack riding positions",
    "Include R.I.T. bag check",
    "Spare bottle count",
    "Harness number",
    "Cylinder number",
    "PSI (fill to 4500)",
    "Electronics operational",
  ]) assert.match(operations, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));

  assert.match(operations, /name !== "1211"/);
  assert.match(operations, /assetType !== "utv"/);
  assert.match(operations, /save_scba_template/);
  assert.match(operations, /record_scba_entry/);
  assert.match(route, /inventory_scba_templates/);
  assert.match(route, /inventory_scba_check_entries/);
  assert.match(route, /checkType === "air_pack"/);
  assert.match(styles, /\.scba-template-editor/);
  assert.match(styles, /\.scba-entry-list/);
});

test("SCBA migration is tenant-scoped, approved by role, and seeds every eligible Stickney rig", async () => {
  const migration = await read("supabase/migrations/20260825154158_weekly_scba_checklists.sql");
  assert.match(migration, /create table if not exists public\.inventory_scba_templates/);
  assert.match(migration, /create table if not exists public\.inventory_scba_check_entries/);
  assert.match(migration, /alter table public\.inventory_scba_templates enable row level security/);
  assert.match(migration, /private\.inventory_can_admin\(department_id\)/);
  assert.match(migration, /private\.inventory_can_write\(department_id\)/);
  assert.match(migration, /lower\(profile\.name\) <> '1211'/);
  assert.match(migration, /lower\(profile\.name\) not like '%utv%'/);
  assert.match(migration, /spare_bottle_count[\s\S]*7/);
  assert.match(migration, /'air_pack'/);
  assert.match(migration, /feeds_daily_duties[\s\S]*feeds_operations_board[\s\S]*require_officer_signoff/);
});
