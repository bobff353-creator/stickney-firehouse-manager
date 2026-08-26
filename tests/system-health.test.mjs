import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync(new URL("../app/api/system-health/route.ts", import.meta.url), "utf8");
const component = readFileSync(new URL("../app/system-health.tsx", import.meta.url), "utf8");
const shell = readFileSync(new URL("../app/payroll-app.tsx", import.meta.url), "utf8");

test("system health is admin-only and uses live service checks", () => {
  assert.match(route, /hasPermission\(request, db, "settings\.manage"\)/);
  assert.match(route, /SELECT 1 AS online/);
  assert.match(route, /auth\.admin\.listUsers/);
  assert.match(route, /storage\.listBuckets/);
  assert.match(route, /VERCEL_GIT_COMMIT_SHA/);
});

test("backup controls do not claim success without a connected verification feed", () => {
  assert.match(route, /Monitoring not connected/);
  assert.match(route, /will not claim zero failures/);
  assert.match(route, /No automated restore test or checksum verification receipt is connected/);
  assert.doesNotMatch(route, /Aug 25|3\.7 GB|412 MB|All systems normal[^"\n]*,/);
});

test("administrators can open the health page from Administration", () => {
  assert.match(shell, /System Health & Backups/);
  assert.match(shell, /activeNav === "System Health"/);
  assert.match(component, /No green check without proof/);
});
