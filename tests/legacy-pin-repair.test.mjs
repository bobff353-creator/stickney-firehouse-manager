import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const loginRoute = readFileSync("app/api/auth/login/route.ts", "utf8");
const gateway = readFileSync("app/auth-gateway.tsx", "utf8");
const edgeFunction = readFileSync("supabase/functions/portal-pin-session/index.ts", "utf8");
const migration = readFileSync("supabase/migrations/20260820203252_repair_legacy_pin_login.sql", "utf8");

test("existing department and non-department owner emails can use direct PIN sign-in", () => {
  assert.match(loginRoute, /Enter your account email/);
  assert.doesNotMatch(loginRoute, /Enter your Stickney email/);
  assert.match(migration, /platform_owners/);
  assert.match(migration, /GRANT EXECUTE[\s\S]*TO service_role/);
});

test("a verified legacy PIN repairs the Supabase password server-side and retries sign-in", () => {
  assert.match(loginRoute, /repairLegacyPassword/);
  assert.match(loginRoute, /functions\/v1\/portal-pin-session/);
  assert.match(edgeFunction, /verify_portal_pin_for_login/);
  assert.match(edgeFunction, /auth\.admin\.updateUserById/);
  assert.match(edgeFunction, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(gateway, /Older account only/);
});
