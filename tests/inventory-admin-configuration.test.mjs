import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const shell = await readFile(new URL("../app/inventory-live.tsx", import.meta.url), "utf8");
const operations = await readFile(new URL("../app/inventory-operations.tsx", import.meta.url), "utf8");
const layout = await readFile(new URL("../app/inventory/layout.tsx", import.meta.url), "utf8");
const portal = await readFile(new URL("../app/payroll-app.tsx", import.meta.url), "utf8");
const styles = await readFile(new URL("../app/inventory/inventory.css", import.meta.url), "utf8");

test("inventory is named Inventory & Apparatus Checks throughout the application shell", () => {
  assert.match(layout, /Inventory & Apparatus Checks/);
  assert.match(shell, /Inventory &amp; Apparatus Checks/);
  assert.match(portal, /label: "Inventory & Apparatus Checks", page: "Inventory"/);
  assert.match(shell, /Admin Configuration/);
});

test("admin configuration exposes vehicle, check, and equipment location controls", () => {
  assert.match(shell, /Apparatus &amp; locations/);
  assert.match(shell, /Checks &amp; equipment/);
  assert.match(shell, /Identity, status, VIN, compartments, photos, and hotspots/);
  assert.match(shell, /Schedules, checklist inclusion, quantities, assets, and approvals/);
  assert.match(operations, /Apparatus and compartment/);
  assert.match(operations, /Required check parameters/);
});

test("administrator setup avoids a single scroll-of-death workspace", () => {
  assert.match(shell, /const \[setupWorkspace, setSetupWorkspace\]/);
  assert.match(shell, /hidden=\{setupWorkspace !== "apparatus"\}/);
  assert.match(shell, /hidden=\{setupWorkspace !== "checks"\}/);
  assert.match(shell, /const \[builderStep, setBuilderStep\]/);
  assert.match(shell, /className="builder-section-nav"/);
  assert.match(shell, /hidden=\{builderStep !== "identity"\}/);
  assert.match(shell, /hidden=\{builderStep !== "compartments"\}/);
  assert.match(shell, /hidden=\{builderStep !== "photos"\}/);
  assert.match(shell, /hidden=\{builderStep !== "hotspots"\}/);
  assert.match(styles, /\.setup-workspace-tabs/);
  assert.match(styles, /\.builder-section\[hidden\]\{display:none!important\}/);
});

test("crew landing page exposes a short operational workflow", () => {
  for (const step of ["Due today", "Inventory check", "Choose an apparatus", "Find equipment", "Repair follow-up"]) {
    assert.match(shell, new RegExp(step));
  }
  assert.match(shell, /Track failed items without duplicate work/);
});

test("equipment directory opens a safe summary before administrator editing", () => {
  assert.match(operations, /Selected equipment record/);
  assert.match(operations, /Assigned vehicle/);
  assert.match(operations, /Exact location/);
  assert.match(operations, /Edit complete asset record/);
  assert.match(operations, /canSetup \? <button className="ops-primary"/);
});
