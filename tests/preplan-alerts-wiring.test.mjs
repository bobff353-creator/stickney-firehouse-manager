import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("field-preplans API exposes alerts and supports save/verify/archive actions", async () => {
  const api = await read("../app/api/field-preplans/route.ts");
  assert.match(api, /field_preplan_alerts/);
  assert.match(api, /action === "saveAlert"/);
  assert.match(api, /action === "verifyAlert"/);
  assert.match(api, /action === "deleteAlert"/);
  // Alerts are archived, never hard-deleted, per the "never automatically hard delete" rule.
  assert.match(api, /UPDATE field_preplan_alerts SET archived=1/);
  assert.match(api, /does not belong to this preplan/);
});

test("respond API sorts and filters alerts through the domain module before returning them", async () => {
  const api = await read("../app/api/respond/route.ts");
  assert.match(api, /sortAlertsForRespond/);
  assert.match(api, /visibleInRespond/);
});

test("Field Preplans has an Alerts tab wired to saveAlert/deleteAlert", async () => {
  const page = await read("../app/field-preplans.tsx");
  assert.match(page, />Alerts</);
  assert.match(page, /action:"saveAlert"/);
  assert.match(page, /action:"deleteAlert"/);
});

test("Respond shows critical/warning alert banners ahead of the room-match banner", async () => {
  const page = await read("../app/respond.tsx");
  const alertBannerIndex = page.indexOf("respond-alert-banner");
  const roomBannerIndex = page.indexOf("respond-room-banner unique");
  assert.ok(alertBannerIndex > -1, "alert banner must be rendered");
  assert.ok(roomBannerIndex > -1, "room banner must be rendered");
  assert.ok(alertBannerIndex < roomBannerIndex, "critical alerts must render ahead of the room-match banner");
  assert.match(page, /severity==="critical"\|\|alert\.severity==="warning"/);
});
