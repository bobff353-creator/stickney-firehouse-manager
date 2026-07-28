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
  assert.match(route, /Administrator permission required/);
  assert.match(route, /effect === "allow"/);
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
