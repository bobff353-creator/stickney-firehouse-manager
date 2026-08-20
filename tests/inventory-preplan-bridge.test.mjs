import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(
  new URL("../supabase/migrations/20260814071322_expose_stickney_fleet_operations_bridge.sql", import.meta.url),
  "utf8",
);

test("PrePlan Fleet bridge exposes each read-only operational relation", () => {
  for (const relation of [
    "stickney_inventory_checks",
    "stickney_inventory_check_items",
    "stickney_inventory_readiness_exceptions",
    "stickney_inventory_work_orders",
  ]) {
    assert.match(migration, new RegExp(`view firehouse\\.${relation}`));
    assert.match(migration, new RegExp(`revoke all on firehouse\\.${relation}`));
  }
  assert.equal((migration.match(/with \(security_invoker = true\)/g) || []).length, 4);
  assert.equal((migration.match(/d\.slug = 'stickney-fire-department'/g) || []).length, 4);
});
