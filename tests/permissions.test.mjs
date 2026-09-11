import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("rank permissions and employee overrides are durable and admin managed", async () => {
  const [bootstrap, route, page] = await Promise.all([
    readFile(new URL("../db/bootstrap.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/permissions/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/permission-settings.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(bootstrap, /CREATE TABLE IF NOT EXISTS rank_permissions/);
  assert.match(bootstrap, /CREATE TABLE IF NOT EXISTS employee_permission_overrides/);
  assert.match(route, /hasPermission\(request, db, "permissions\.manage"\)/);
  assert.match(route, /effect === "allow"/);
  assert.match(route, /GROUP BY label ORDER BY sortOrder,label/);
  assert.doesNotMatch(route, /SELECT DISTINCT label rank/);
  assert.match(page, /Permissions by rank/);
  assert.match(page, /Employee exceptions/);
});

test("member testing is visibly labeled and never impersonates server identity", async () => {
  const [page, app] = await Promise.all([
    readFile(new URL("../app/permission-settings.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/payroll-app.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(page, /does not sign you in as the employee/);
  assert.match(app, /No identity or approval authority has changed/);
  assert.doesNotMatch(page, /oai-authenticated-user-email/);
});

test("firefighters can operate an unlocked Daily Log while document editing stays separately controlled", async () => {
  const [permissions, logbook, resources, resourcePage] = await Promise.all([
    readFile(new URL("../app/permissions.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/logbook/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/resources/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/resource-pages.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(permissions, /firefighterPermissions.*daily_log\.view.*daily_log\.manage/);
  assert.match(logbook, /"daily_log\.manage"/);
  assert.match(logbook, /This daily log is locked/);
  assert.match(resources, /"policies\.manage"/);
  assert.match(resources, /"box_cards\.manage"/);
  assert.match(resourcePage, /data-test-safe/);
});

test("every employee keeps a read-only own-timesheet view including administrator Test View", async () => {
  const [permissions, route, app] = await Promise.all([
    readFile(new URL("../app/permissions.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/permissions/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/payroll-app.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(permissions, /payroll\.view_own.*required: true/);
  assert.match(permissions, /selected\.add\("payroll\.view_own"\)/);
  assert.match(app, /const adminNavItems: NavItem\[\] = \[[^\]]*"My Timesheet"/);
  assert.match(app, /"My Timesheet": "payroll\.view_own"/);
  assert.match(app, /activeNav === "My Timesheet" \? ownTimesheetEmployeeId/);
  assert.match(app, /const canEditEntry = activeNav === "Timesheets" && isPayrollManagerView/);
  assert.match(app, /activeNav === "Timesheets" && isPayrollManagerView \? .*employee-select/);
  assert.match(app, /Hourly rate/);
});

test("payroll management can be removed from a specific administrator and is enforced by the API", async () => {
  const [serverPermissions, route, permissionRoute, page, app] = await Promise.all([
    readFile(new URL("../app/server-permissions.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/payroll/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/permissions/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/permission-settings.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/payroll-app.tsx", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(serverPermissions, /if \(employee\.isAdmin\) return new Set/);
  assert.doesNotMatch(permissionRoute, /if \(employee\.isAdmin\) return permissionCatalog/);
  assert.match(route, /canManagePayroll: permissions\.has\("payroll\.manage"\)/);
  assert.doesNotMatch(route, /canManagePayroll: isAdmin &&/);
  assert.match(route, /viewer\.canManagePayroll \? db\.prepare\(`\$\{entrySelect\}/);
  assert.match(route, /Payroll management permission is required to change timesheets or rates/);
  assert.match(route, /rateHistory: viewer\.canManagePayroll \?/);
  assert.match(page, /Administrators begin with full access/);
  assert.match(page, /Save employee exceptions/);
  assert.match(app, /navigationForViewer/);
  assert.match(app, /viewer\.canManagePayroll/);
});

test("permission saves are verified and refresh the active permission snapshot", async () => {
  const [route, page, app, styles] = await Promise.all([
    readFile(new URL("../app/api/permissions/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/permission-settings.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/payroll-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(route, /saved: true/);
  assert.match(route, /could not be verified/);
  assert.match(page, /cache: "no-store"/);
  assert.match(page, /onPermissionsSaved\(refreshed\)/);
  assert.match(app, /function permissionsSaved/);
  assert.match(styles, /data-test-safe.*cursor: pointer !important/);
});

test("Dashboard disappears and cannot remain active when its permission is removed", async () => {
  const app = await readFile(new URL("../app/payroll-app.tsx", import.meta.url), "utf8");
  assert.match(app, /featuredNavItems\.filter\(\(item\) => visibleNav\.includes\(item\.page\)\)/);
  assert.match(app, /visibleFeaturedNav\.map\(\(item\) => <button/);
  assert.match(app, /!visibleNav\.includes\(activeNav\).*setActiveNav\(homePage\)/s);
  assert.match(app, /onClick=\{\(\) => navigate\(homePage\)\}/);
  assert.match(app, /firstPermitted.*setActiveNav\(firstPermitted \?\? "My Timesheet"\)/s);
});
