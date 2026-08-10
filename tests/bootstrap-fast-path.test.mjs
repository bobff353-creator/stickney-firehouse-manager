import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../db/bootstrap.ts", import.meta.url), "utf8");
const markerMigration = await readFile(
  new URL("../supabase/migrations/20260810030809_mark_web_push_runtime_bootstrap.sql", import.meta.url),
  "utf8",
);

test("database bootstrap uses a durable version fast path and applies new schema once", () => {
  assert.match(source, /runtime_bootstrap_version/);
  assert.match(source, /marker\?\.value === runtimeBootstrapVersion/);
  assert.match(source, /station-scheduler-v3/);
  assert.match(source, /A stale \(or missing\) runtime marker falls through to initializeDatabase/);
  assert.match(source, /if \(ready\) return db/);
  assert.doesNotMatch(source, /if \(ready\) \{[\s\S]*?importApproved1203WeeklyCheck/);
  assert.doesNotMatch(source, /if \(ready\) \{[\s\S]*?importApproved1204WeeklyCheck/);
});

test("concurrent cold requests share one database initialization", () => {
  assert.match(source, /initializationPromise \?\?= initializeDatabase\(db\)/);
  assert.match(source, /return await initializationPromise/);
});

test("the deployed migration advances the runtime bootstrap marker", () => {
  const version = source.match(/runtimeBootstrapVersion\s*=\s*"([^"]+)"/)?.[1];

  assert.ok(version, "runtime bootstrap version must be declared");
  assert.match(markerMigration, /to_regclass\('firehouse\.push_subscriptions'\)/);
  assert.ok(
    markerMigration.includes(version),
    `marker migration must install runtime bootstrap version ${version}`,
  );
});
