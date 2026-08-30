import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("mobile equipment editor keeps inspection choices readable in dark mode", async () => {
  const styles = await readFile(new URL("../app/inventory/inventory.css", import.meta.url), "utf8");
  assert.match(styles, /\.equipment-editor \.ops-check-grid label\{min-height:44px;[^}]*font-size:12px/);
  assert.match(styles, /\.equipment-editor \.ops-check-grid label\{min-height:50px;font-size:13px\}/);
  assert.match(styles, /@media\(prefers-color-scheme:dark\)\{\.equipment-editor \.ops-check-grid label\{[^}]*color:#f4f8fa/);
});
test("fleet cards clearly open unit checks and stay readable on dark phones", async () => {
  const [styles, fleet, operations] = await Promise.all([
    readFile(new URL("../app/inventory/inventory.css", import.meta.url), "utf8"),
    readFile(new URL("../app/inventory-live.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/inventory-operations.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(fleet, /Open Apparatus Checks &amp; Inventory/);
  assert.match(fleet, /Daily · Weekly · Inventory · Air Pack/);
  assert.match(operations, /inspection-choice-action[^\n]*Tap to resume[^\n]*Tap to open/);
  assert.match(styles, /\.card-action \{[^}]*min-height: 58px;[^}]*background: var\(--red\)/);
  assert.match(styles, /@media\(max-width:820px\)\{\.fleet-page \.page-heading p\{[^}]*font-size:14px/);
  assert.match(styles, /@media\(prefers-color-scheme:dark\)\{\.fleet-page \.page-heading p\{color:#c8d5d9/);
});

test("inventory uses its own full-width shell instead of the portal sidebar grid", async () => {
  const [styles, inventory] = await Promise.all([
    readFile(new URL("../app/inventory/inventory.css", import.meta.url), "utf8"),
    readFile(new URL("../app/inventory-live.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(inventory, /<main className="inventory-app-shell inventory-portal-refresh">/);
  assert.doesNotMatch(inventory, /<main className="app-shell">/);
  assert.match(styles, /\.inventory-app-shell \{ display: block; width: 100%; min-width: 0; min-height: 100vh; \}/);
});

test("inventory uses one clear workspace header and section bar", async () => {
  const [styles, inventory] = await Promise.all([
    readFile(new URL("../app/inventory/inventory.css", import.meta.url), "utf8"),
    readFile(new URL("../app/inventory-live.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(inventory, /className="inventory-command-hero"/);
  assert.match(inventory, /aria-label="Inventory sections"/);
  assert.match(inventory, /Live department records · no sample inventory/);
  assert.match(styles, /\.inventory-section-nav\{/);
  assert.match(styles, /\.inventory-command-hero\{/);
});

test("inventory keeps desktop labels readable and removes the phone stock-table overflow", async () => {
  const styles = await readFile(new URL("../app/inventory/inventory.css", import.meta.url), "utf8");

  assert.match(styles, /End-user usability baseline/);
  assert.match(styles, /\.inventory-portal-refresh \.ops-form label,[\s\S]*font-size: 11px/);
  assert.match(styles, /\.inventory-portal-refresh :is\([^}]*\) \{ min-height: 44px/);
  assert.match(styles, /\.inventory-portal-refresh \.stock-table article\{min-width:0/);
  assert.match(styles, /\.inventory-portal-refresh \.suite-switcher\{[^}]*bottom:calc\(78px/);
  assert.match(styles, /\.inventory-portal-refresh \.mobile-nav\{grid-template-columns:repeat\(4,1fr\);height:auto;min-height:104px\}/);
  assert.match(styles, /\.inventory-portal-refresh \.inventory-command-back \{ min-height: 44px; \}/);
});
