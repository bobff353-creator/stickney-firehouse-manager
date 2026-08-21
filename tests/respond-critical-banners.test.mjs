import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const route = fs.readFileSync("app/api/respond/route.ts", "utf8");
const respond = fs.readFileSync("app/respond.tsx", "utf8");

test("Respond API supplies published target-hazard and alert lifecycle fields", () => {
  assert.match(route, /target_hazard_level targetHazardLevel/);
  assert.match(route, /target_hazard_reasons targetHazardReasons/);
  assert.match(route, /alert_type alertType/);
  assert.match(route, /expiredUnverified/);
});

test("Respond surfaces target hazards and access problems as critical banners", () => {
  assert.match(respond, /TARGET HAZARD/);
  assert.match(respond, /ACCESS PROBLEM \/ ENTRY NOTE/);
  assert.match(respond, /targetHazardReasons\.join/);
});

test("Respond distinguishes command, temporary, and expired verification alerts", () => {
  assert.match(respond, /EXPIRED — VERIFY/);
  assert.match(respond, /COMMAND NOTE/);
  assert.match(respond, /TEMPORARY HAZARD/);
});
