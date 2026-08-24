import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const shell = await readFile(new URL("../app/inventory-live.tsx", import.meta.url), "utf8");
const operations = await readFile(new URL("../app/inventory-operations.tsx", import.meta.url), "utf8");
const layout = await readFile(new URL("../app/inventory/layout.tsx", import.meta.url), "utf8");

test("inventory is named Vehicle Checks & Inventory throughout the application shell", () => {
  assert.match(layout, /Vehicle Checks & Inventory/);
  assert.match(shell, /Vehicle Checks &amp; Inventory/);
  assert.match(shell, /Admin Configuration/);
});

test("admin configuration exposes vehicle, check, and equipment location controls", () => {
  assert.match(shell, /Vehicle parameters/);
  assert.match(shell, /Check parameters/);
  assert.match(shell, /Equipment location/);
  assert.match(operations, /Required equipment location/);
  assert.match(operations, /Required check parameters/);
});

test("crew landing page exposes a short operational workflow", () => {
  for (const step of ["Due today", "Choose a vehicle", "Find equipment", "Repair follow-up"]) {
    assert.match(shell, new RegExp(step));
  }
  assert.match(shell, /Track failed items without duplicate work/);
});

test("equipment directory opens a safe summary before administrator editing", () => {
  assert.match(operations, /Selected equipment record/);
  assert.match(operations, /Assigned vehicle/);
  assert.match(operations, /Exact location/);
  assert.match(operations, /Edit equipment parameters/);
  assert.match(operations, /canSetup \? <button className="ops-primary"/);
});
