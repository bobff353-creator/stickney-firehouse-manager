import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../db/bootstrap.ts", import.meta.url), "utf8");

test("database bootstrap uses a durable version fast path and applies new schema once", () => {
  assert.match(source, /runtime_bootstrap_version/);
  assert.match(source, /marker\?\.value === runtimeBootstrapVersion/);
  assert.match(source, /station-scheduler-v2/);
  assert.match(source, /A stale \(or missing\) runtime marker falls through to initializeDatabase/);
  assert.match(source, /if \(ready\) return db/);
  assert.doesNotMatch(source, /if \(ready\) \{[\s\S]*?importApproved1203WeeklyCheck/);
  assert.doesNotMatch(source, /if \(ready\) \{[\s\S]*?importApproved1204WeeklyCheck/);
});

test("concurrent cold requests share one database initialization", () => {
  assert.match(source, /initializationPromise \?\?= initializeDatabase\(db\)/);
  assert.match(source, /return await initializationPromise/);
});
