import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { fireFlowCalculationArea, polygonAreaSquareFeet, suggestedFireFlow } from "../app/preplan-fire-flow.ts";
import { importedBuildingSeeds } from "../app/preplan-imported-buildings.ts";

test("supplied building workbook becomes 117 traceable preplan starters", async () => {
  assert.equal(importedBuildingSeeds.length, 117);
  assert.deepEqual(importedBuildingSeeds[0], { sourceRow:5, address:"3501 Laramie", businessName:"HRT" });
  assert.deepEqual(importedBuildingSeeds.at(-1), { sourceRow:121, address:"7122 40th St", businessName:"Jewel-Osco" });
  assert.equal(new Set(importedBuildingSeeds.map((item) => item.sourceRow)).size, 117);
  const [page, api, bootstrap] = await Promise.all([
    readFile(new URL("../app/field-preplans.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/field-preplans/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/bootstrap.ts", import.meta.url), "utf8"),
  ]);
  assert.match(bootstrap, /CREATE TABLE IF NOT EXISTS field_preplan_imports/);
  assert.match(api, /imports:imports\.results/);
  assert.match(api, /linked_preplan_id/);
  assert.match(page, /Preplan Starters/);
  assert.match(page, /Address matches are automatic/);
  assert.match(page, /Locate & Build/);
  assert.match(page, /Locate imported addresses/);
  assert.match(page, /groupedImports/);
  assert.match(page, /of \{imports\.length\} completed/);
  assert.match(api, /batchGeocodeImports/);
  assert.match(api, /maps\.googleapis\.com\/maps\/api\/geocode\/json/);
  assert.match(api, /status='geocoded'/);
  assert.match(bootstrap, /geocode_note/);
  assert.equal(importedBuildingSeeds.some((item) => /Harlm|Pershong|Persing Rd/i.test(`${item.address} ${item.businessName}`)), false);
});

test("multi-point overhead footprints calculate ground square footage", () => {
  const area = polygonAreaSquareFeet([
    { lat: 41.8189, lng: -87.7734 },
    { lat: 41.8189, lng: -87.7730 },
    { lat: 41.8191, lng: -87.7729 },
    { lat: 41.81925, lng: -87.7731 },
    { lat: 41.81915, lng: -87.77345 },
  ]);
  assert.equal(area > 9_000 && area < 15_000, true);
});

test("IFC Appendix B advisory flow uses total levels and sprinkler assumptions", () => {
  assert.equal(fireFlowCalculationArea(10_000, 4, "VB"), 40_000);
  assert.equal(fireFlowCalculationArea(10_000, 5, "IA_IB"), 30_000);
  const result = suggestedFireFlow({
    footprintSquareFeet: 10_000,
    floorCount: 1,
    constructionType: "VB",
    occupancyFlowCategory: "other",
    sprinklerStandard: "nfpa13",
  });
  assert.equal(result?.baseGpm, 2750);
  assert.equal(result?.suggestedGpm, 1000);
  assert.equal(result?.durationHours, 2);
});

test("Field Preplans provides map-first quick and detailed capture", async () => {
  const [page, api, hydrantApi, bootstrap, shell, permissions, googleMap, mapsConfig, styles] = await Promise.all([
    readFile(new URL("../app/field-preplans.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/field-preplans/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/field-hydrants/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/bootstrap.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/payroll-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/permissions.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/google-field-map.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/maps-config/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
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
  assert.match(page, /Place corner points/);
  assert.match(page, /Accept Footprint/);
  assert.match(page, /footprintAccepted/);
  assert.match(page, /polygonAreaSquareFeet/);
  assert.match(page, /Suggested fire flow/);
  assert.match(page, /private A-side \/ fallback GPS point/);
  assert.match(page, /zoom >= 17/);
  for (const label of ["Knox Box","FDC","Riser","Gas Shutoff","Water Shutoff","Electrical Panel","Propane Tank","Elevator Room","Standpipe"]) assert.match(page, new RegExp(label));
  for (const side of ['["A","B","C","D"]']) assert.match(page, new RegExp(side.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(api, /at least three footprint corners/);
  assert.match(api, /footprint_square_feet/);
  assert.match(page, /DeleteRecordControl/);
  assert.match(page, /Confirm Delete/);
  assert.match(page, /action:"deletePreplan"/);
  assert.match(page, /action:"deleteHydrant"/);
  assert.match(api, /action === "deletePreplan"/);
  assert.match(api, /confirmation !== "DELETE"/);
  assert.match(api, /DELETE FROM field_preplan_photos/);
  assert.match(api, /DELETE FROM field_preplan_features/);
  assert.match(api, /linked_preplan_id=NULL/);
  assert.match(hydrantApi, /action==="deleteHydrant"/);
  assert.match(hydrantApi, /DELETE FROM field_hydrant_flow_tests/);
  assert.match(hydrantApi, /DELETE FROM field_hydrant_flushes/);
  assert.match(bootstrap, /CREATE TABLE IF NOT EXISTS field_preplans/);
  assert.match(bootstrap, /CREATE TABLE IF NOT EXISTS field_preplan_features/);
  assert.match(bootstrap, /CREATE TABLE IF NOT EXISTS field_preplan_photos/);
  assert.match(page, /Google Maps/);
  assert.match(page, /Google Maps ·/);
  assert.match(page, /Backup map/);
  assert.match(styles, /\.field-map\.google-active \.field-map-tiles\{visibility:hidden\}/);
  assert.match(googleMap, /maps\.googleapis\.com\/maps\/api\/js/);
  assert.match(googleMap, /loading=async/);
  assert.doesNotMatch(googleMap, /auth_referrer_policy=origin/);
  assert.match(googleMap, /gm_authFailure/);
  assert.match(page, /apiKey&&!googleFailed&&<GoogleFieldMap/);
  assert.match(googleMap, /gestureHandling/);
  assert.match(googleMap, /featureType: "poi"/);
  assert.match(googleMap, /"satellite"/);
  assert.match(mapsConfig, /process\.env\.GOOGLE_MAPS_BROWSER_KEY/);
  assert.match(mapsConfig, /Authentication required/);
});
