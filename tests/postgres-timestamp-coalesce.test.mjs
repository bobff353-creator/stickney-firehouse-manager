import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const files = [
  "../db/bootstrap.ts",
  "../app/api/dashboard/route.ts",
  "../app/api/incident-command/route.ts",
  "../app/api/logbook/route.ts",
  "../app/api/payroll/route.ts",
  "../app/api/resources/route.ts",
  "../app/api/respond/route.ts",
];

const source = files.map((file) => readFileSync(new URL(file, import.meta.url), "utf8")).join("\n");
const adapter = readFileSync(new URL("../db/postgres-adapter.ts", import.meta.url), "utf8");

test("Postgres timestamp fallbacks use one explicit text type", () => {
  assert.doesNotMatch(source, /COALESCE\(cleared_at,\s*CURRENT_TIMESTAMP\)/i);
  assert.doesNotMatch(source, /COALESCE\(locked_at,\s*CURRENT_TIMESTAMP\)/i);
  assert.doesNotMatch(source, /COALESCE\(created_at,\s*updated_at\)/i);
  assert.match(source, /COALESCE\(cleared_at,\s*CAST\(CURRENT_TIMESTAMP AS TEXT\)\)/i);
  assert.match(source, /COALESCE\(CAST\(created_at AS TEXT\),\s*CAST\(updated_at AS TEXT\)\)/i);
});

test("SQLite date and datetime compatibility functions preserve their text return type", () => {
  assert.match(adapter, /CREATE FUNCTION \$\{APP_SCHEMA\}\.datetime[\s\S]*?RETURNS text/);
  assert.match(adapter, /CREATE FUNCTION \$\{APP_SCHEMA\}\.date[\s\S]*?RETURNS text/);
  assert.doesNotMatch(adapter, /CREATE OR REPLACE FUNCTION date[\s\S]*?RETURNS date/);
  assert.doesNotMatch(adapter, /CREATE OR REPLACE FUNCTION datetime[\s\S]*?RETURNS timestamp/);
});
