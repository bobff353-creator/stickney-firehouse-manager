import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("Field Preplans provides map-first quick and detailed capture", async () => {
  const [page, api, bootstrap, shell, permissions, googleMap, mapsConfig] = await Promise.all([
    readFile(new URL("../app/field-preplans.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/field-preplans/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/bootstrap.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/payroll-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/permissions.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/google-field-map.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/maps-config/route.ts", import.meta.url), "utf8"),
  ]);
  assert.match(shell, /label: "Field"/);
  assert.match(shell, /activeNav === "Field Preplans"/);
  assert.match(permissions, /field_preplans\.view/);
  assert.match(permissions, /field_preplans\.edit/);
  assert.match(page, /Current location/);
  assert.match(page, /onPointerMove/);
  assert.match(page, /onDoubleClick/);
  assert.match(page, /onWheel/);
  assert.match(page, /Drag to move/);
  assert.match(page, /Math\.min\(21,zoom\+1\)/);
  assert.match(page, /Assisted outline/);
  assert.match(page, /Click corners/);
  assert.match(page, /private A-side \/ fallback GPS point/);
  assert.match(page, /zoom >= 17/);
  for (const label of ["Knox Box","FDC","Riser","Gas Shutoff","Water Shutoff","Electrical Panel","Propane Tank","Elevator Room","Standpipe"]) assert.match(page, new RegExp(label));
  for (const side of ['["A","B","C","D"]']) assert.match(page, new RegExp(side.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(api, /at least three footprint corners/);
  assert.match(bootstrap, /CREATE TABLE IF NOT EXISTS field_preplans/);
  assert.match(bootstrap, /CREATE TABLE IF NOT EXISTS field_preplan_features/);
  assert.match(bootstrap, /CREATE TABLE IF NOT EXISTS field_preplan_photos/);
  assert.match(page, /Google Maps/);
  assert.match(page, /Backup map/);
  assert.match(googleMap, /maps\.googleapis\.com\/maps\/api\/js/);
  assert.match(googleMap, /loading=async/);
  assert.match(googleMap, /auth_referrer_policy=origin/);
  assert.match(googleMap, /gestureHandling/);
  assert.match(mapsConfig, /runtime\["Maps Platform API Key"\]/);
  assert.match(mapsConfig, /Authentication required/);
});
