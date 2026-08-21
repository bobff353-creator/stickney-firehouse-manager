import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const config = fs.readFileSync("app/supabase-config.ts", "utf8");
const server = fs.readFileSync("app/supabase-server.ts", "utf8");
const adapter = fs.readFileSync("db/postgres-adapter.ts", "utf8");
const audit = fs.readFileSync("docs/preplan-v2-environment-audit.md", "utf8");

test("preview database routing uses deployment Supabase coordinates instead of DATABASE_URL", () => {
  assert.match(config, /process\.env\.NEXT_PUBLIC_SUPABASE_URL/);
  assert.match(config, /process\.env\.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/);
  assert.match(server, /getPublicSupabaseConfig/);
  assert.match(adapter, /getSupabaseServerClient/);
  assert.match(adapter, /supabase\.rpc\(rpc/);
  assert.doesNotMatch(`${config}\n${server}\n${adapter}`, /DATABASE_URL/);
});

test("environment audit does not overstate preview isolation", () => {
  assert.match(audit, /project reference `pzgvlslcaoqtrnaqyjmd`/);
  assert.match(audit, /with_data: false/);
  assert.match(audit, /18 present, 18 with RLS enabled, 18 policies total/);
  assert.match(audit, /one in review.*zero published/);
  assert.match(audit, /MIGRATIONS_FAILED/);
  assert.match(audit, /deployment-to-project-reference match cannot be independently read back/);
  assert.match(audit, /Do not run migrations, fixtures, uploads, lifecycle actions, or destructive browser tests/);
  assert.match(audit, /non-Preplan security advisor findings/);
  assert.doesNotMatch(audit, /SUPABASE_SECRET_KEY\s*=/);
});
