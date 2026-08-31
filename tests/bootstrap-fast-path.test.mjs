import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../db/bootstrap.ts", import.meta.url), "utf8");
const markerMigration = await readFile(
  new URL("../supabase/migrations/20260831213454_add_aladtec_safety_inspection_templates.sql", import.meta.url),
  "utf8",
);

test("database bootstrap uses a durable version fast path without runtime DDL", () => {
  assert.match(source, /runtime_bootstrap_version/);
  assert.match(source, /marker\?\.value !== runtimeBootstrapVersion/);
  assert.match(source, /Apply the required Supabase migrations/);
  assert.match(source, /if \(ready\) return db/);
  assert.doesNotMatch(source.slice(source.indexOf("export async function ensureDatabase")), /initializeDatabase\(db\)/);
  assert.doesNotMatch(source, /if \(ready\) \{[\s\S]*?importApproved1203WeeklyCheck/);
  assert.doesNotMatch(source, /if \(ready\) \{[\s\S]*?importApproved1204WeeklyCheck/);
});

test("a stale production marker cannot trigger schema changes through the query gateway", () => {
  const ensureDatabase = source.slice(source.indexOf("export async function ensureDatabase"));
  assert.doesNotMatch(ensureDatabase, /CREATE TABLE|ALTER TABLE|initializeDatabase/);
});

test("the deployed migration advances the runtime bootstrap marker", () => {
  const version = source.match(/runtimeBootstrapVersion\s*=\s*"([^"]+)"/)?.[1];

  assert.ok(version, "runtime bootstrap version must be declared");
  assert.match(markerMigration, /safety_inspection_templates/);
  assert.match(markerMigration, /safety_inspection_template_items/);
  assert.match(markerMigration, /item_count <> 128/);
  assert.ok(
    markerMigration.includes(version),
    `marker migration must install runtime bootstrap version ${version}`,
  );
});
