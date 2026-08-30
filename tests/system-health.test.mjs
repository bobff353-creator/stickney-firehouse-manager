import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync(new URL("../app/api/system-health/route.ts", import.meta.url), "utf8");
const component = readFileSync(new URL("../app/system-health.tsx", import.meta.url), "utf8");
const shell = readFileSync(new URL("../app/payroll-app.tsx", import.meta.url), "utf8");
const providerHealthMigration = readFileSync(new URL("../supabase/migrations/20260830151225_add_system_health_usage_function.sql", import.meta.url), "utf8");
const loginAuditMigration = readFileSync(new URL("../supabase/migrations/20260830181919_add_portal_login_audit.sql", import.meta.url), "utf8");
const loginRoute = readFileSync(new URL("../app/api/auth/login/route.ts", import.meta.url), "utf8");

test("system health is admin-only and uses live service checks", () => {
  assert.match(route, /hasPermission\(request, db, "settings\.manage"\)/);
  assert.match(route, /SELECT 1 AS online/);
  assert.match(route, /FROM system_health_usage\(\)/);
  assert.match(route, /Authenticated accounts/);
  assert.match(route, /department-protected health function/);
  assert.match(route, /VERCEL_GIT_COMMIT_SHA/);
  assert.match(route, /VERCEL_GIT_COMMIT_REF/);
  assert.match(route, /VERCEL_GIT_REPO_SLUG/);
  assert.match(providerHealthMigration, /SECURITY DEFINER/);
  assert.match(providerHealthMigration, /SET search_path = ''/);
  assert.match(providerHealthMigration, /firehouse\.has_department_access\(\)/);
  assert.match(providerHealthMigration, /FROM storage\.objects/);
  assert.match(providerHealthMigration, /FROM auth\.users/);
  assert.match(providerHealthMigration, /REVOKE ALL ON FUNCTION firehouse\.system_health_usage\(\) FROM anon/);
  assert.match(providerHealthMigration, /GRANT EXECUTE ON FUNCTION firehouse\.system_health_usage\(\) TO authenticated/);
  assert.match(route, /FROM system_health_login_audit\(\)/);
  assert.match(route, /building its first complete 24-hour window/);
  assert.match(loginRoute, /INSERT INTO portal_login_audit/);
  assert.match(loginRoute, /recordLoginAudit\("failed_pin"\)/);
  assert.match(loginRoute, /recordLoginAudit\("success"\)/);
  assert.match(loginAuditMigration, /CREATE TABLE IF NOT EXISTS firehouse\.portal_login_audit/);
  assert.match(loginAuditMigration, /No email address|outcome text/);
  assert.match(loginAuditMigration, /SECURITY DEFINER/);
  assert.match(loginAuditMigration, /SET search_path = ''/);
  assert.match(loginAuditMigration, /firehouse\.has_department_access\(\)/);
  assert.match(loginAuditMigration, /REVOKE ALL ON TABLE firehouse\.portal_login_audit FROM anon/);
  assert.match(loginAuditMigration, /GRANT EXECUTE ON FUNCTION firehouse\.system_health_login_audit\(\) TO authenticated/);
});

test("backup controls do not claim success without a connected verification feed", () => {
  assert.match(route, /Monitoring not connected/);
  assert.match(route, /No automated restore test or checksum verification receipt is connected/);
  assert.match(route, /id: "database-usage"[\s\S]*state: "healthy"/);
  assert.match(route, /id: "storage-usage"[\s\S]*state: "healthy"/);
  assert.doesNotMatch(route, /Provider usage telemetry is not available to the portal runtime/);
  assert.doesNotMatch(route, /Aug 25|3\.7 GB|412 MB|All systems normal[^"\n]*,/);
});

test("administrators can open the health page from Administration", () => {
  assert.match(shell, /System Health & Backups/);
  assert.match(shell, /activeNav === "System Health"/);
  assert.match(component, /No green check without proof/);
});
