import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const adapter = readFileSync("db/postgres-adapter.ts", "utf8");
const migration = readFileSync(
  "supabase/migrations/20260820205539_allow_server_portal_updates_and_upserts.sql",
  "utf8",
);

test("server gateway accepts the adapter's safe update and upsert syntax", () => {
  assert.match(adapter, /ON CONFLICT DO NOTHING/);
  assert.match(migration, /select\|insert\|update\|delete\|with/);
  assert.doesNotMatch(migration, /copy\|call\|do\|set\|show/);
  assert.match(migration, /copy\|call\|show\|reset/);
});

test("server gateway keeps cross-schema and multi-statement protections", () => {
  assert.match(migration, /Cross-schema portal query denied/);
  assert.match(migration, /Unsafe portal query/);
  assert.match(migration, /create\|alter\|drop\|truncate\|grant\|revoke/);
});
