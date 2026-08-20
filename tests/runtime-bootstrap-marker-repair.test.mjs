import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const bootstrap = readFileSync("db/bootstrap.ts", "utf8");
const migration = readFileSync(
  "supabase/migrations/20260820210435_restore_runtime_bootstrap_marker.sql",
  "utf8",
);

test("repair migration restores the marker expected by the selected portal build", () => {
  const expectedMarker = "stickney-runtime-bootstrap-2026-08-10-callback-rules-v2";
  assert.match(bootstrap, new RegExp(expectedMarker));
  assert.match(migration, new RegExp(expectedMarker));
});

test("repair migration verifies schema prerequisites before advancing the marker", () => {
  assert.match(migration, /to_regclass\('firehouse\.station_shift_types'\)/);
  assert.match(migration, /to_regclass\('firehouse\.push_subscriptions'\)/);
  assert.match(migration, /to_regclass\('firehouse\.daily_log_callback_submissions'\)/);
  assert.match(migration, /information_schema\.columns/);
  assert.match(migration, /callback_review_settings[\s\S]+id = 'default'/);
});
