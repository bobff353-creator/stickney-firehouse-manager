import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { expirationState } from "../app/preplans/expiration-evaluator.ts";

const evaluator = fs.readFileSync(
  "app/preplans/expiration-evaluator.ts",
  "utf8",
);
const cron = fs.readFileSync("app/api/cron/daily-refresh/route.ts", "utf8");
const alerts = fs.readFileSync("app/api/alerts/route.ts", "utf8");

test("expiration evaluation uses valid instants without database text/date comparison", () => {
  const now = new Date("2026-08-20T12:00:00.000Z");
  assert.equal(expirationState("2026-08-19T12:00:00.000Z", now), "expired");
  assert.equal(expirationState("2026-09-01T12:00:00.000Z", now), "upcoming");
  assert.equal(expirationState("2027-01-01T12:00:00.000Z", now), "future");
  assert.equal(expirationState("not-a-date", now), "invalid");
  assert.doesNotMatch(
    evaluator,
    /expires_at\s*(?:>=|<=|>|<)\s*(?:date|CURRENT_DATE)/i,
  );
});

test("daily cron evaluates every expiring operational record without mutation", () => {
  for (const table of [
    "field_preplan_alerts",
    "field_preplan_hazmat",
    "field_preplan_hazmat_zones",
    "field_preplan_annotations",
  ])
    assert.match(evaluator, new RegExp(table));
  assert.match(cron, /evaluatePreplanExpirations/);
  assert.match(cron, /preplanExpirationReview/);
  assert.doesNotMatch(evaluator, /\b(?:UPDATE|DELETE|INSERT)\b/);
});

test("administrative smart alerts deduplicate expiration review into one notice", () => {
  assert.match(alerts, /id: "preplan-expiration-review"/);
  assert.match(alerts, /expiration\.reviewCount/);
  assert.match(alerts, /page: "Field Preplans"/);
});
