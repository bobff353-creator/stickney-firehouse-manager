import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("Inventory opens on crew work and keeps setup administrator-only", async () => {
  const [shell, operations, permissions] = await Promise.all([
    read("app/inventory-live.tsx"),
    read("app/inventory-operations.tsx"),
    read("app/permissions.ts"),
  ]);

  for (const label of ["Due Now", "Fleet", "Equipment", "Meds & Stock", "Repairs", "Build & Templates"]) {
    assert.match(shell, new RegExp(label.replace("&", "&")));
  }
  assert.match(shell, /view === "setup" && canSetup/);
  assert.match(operations, /No required Fleet checks are waiting/);
  for (const stage of ["New", "Assigned", "In Repair", "Waiting Parts", "Completed"]) {
    assert.match(operations, new RegExp(stage));
  }
  for (const permission of ["inventory.view", "inventory.check", "inventory.repairs.manage", "inventory.setup.manage"]) {
    assert.match(permissions, new RegExp(permission.replaceAll(".", "\\.")));
  }
});

test("Inventory exposes barcode search, expirations, and restock approvals", async () => {
  const [shell, operations, route] = await Promise.all([
    read("app/inventory-live.tsx"),
    read("app/inventory-operations.tsx"),
    read("app/api/operations/route.ts"),
  ]);

  assert.match(shell, /Scan Barcode/);
  assert.match(operations, /Name, barcode, serial, compartment, or unit/);
  assert.match(operations, /Lot number/);
  assert.match(operations, /Expiration date/);
  assert.match(operations, /Request restock/);
  assert.match(operations, /RESTOCK APPROVALS/);
  assert.match(route, /request_restock/);
  assert.match(route, /approve_restock/);
  assert.match(route, /fulfill_restock/);
});
