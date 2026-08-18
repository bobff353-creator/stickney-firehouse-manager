import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import {
  alertTypeLabel,
  isAlertActive,
  isAlertExpired,
  isCriticalOrWarning,
  needsVerification,
  severityLabel,
  sortAlertsForRespond,
  visibleInRespond,
} from "../app/preplans/alerts.ts";

function makeAlert(overrides = {}) {
  return {
    id: "alert-1",
    preplanId: "preplan-1",
    levelId: null,
    alertType: "general_note",
    title: "Note",
    instructions: "",
    severity: "advisory",
    displayOrder: 0,
    pinToRespond: false,
    effectiveAt: null,
    expiresAt: null,
    verificationRequired: false,
    verifiedBy: "",
    verifiedAt: null,
    archived: false,
    createdBy: "system",
    updatedBy: "system",
    ...overrides,
  };
}

test("critical and warning alerts sort ahead of advisory and informational ones", () => {
  const alerts = [
    makeAlert({ id: "a", severity: "informational", displayOrder: 0 }),
    makeAlert({ id: "b", severity: "critical", displayOrder: 5 }),
    makeAlert({ id: "c", severity: "warning", displayOrder: 1 }),
    makeAlert({ id: "d", severity: "advisory", displayOrder: 0 }),
    makeAlert({ id: "e", severity: "critical", displayOrder: 1 }),
  ];
  const sorted = sortAlertsForRespond(alerts);
  assert.deepEqual(sorted.map((a) => a.id), ["e", "b", "c", "d", "a"]);
});

test("isCriticalOrWarning distinguishes the two highest severities", () => {
  assert.equal(isCriticalOrWarning("critical"), true);
  assert.equal(isCriticalOrWarning("warning"), true);
  assert.equal(isCriticalOrWarning("advisory"), false);
  assert.equal(isCriticalOrWarning("informational"), false);
});

test("an alert is active only within its effective/expiration window and not archived", () => {
  const now = new Date("2026-08-18T12:00:00Z");
  assert.equal(isAlertActive(makeAlert(), now), true);
  assert.equal(isAlertActive(makeAlert({ archived: true }), now), false);
  assert.equal(isAlertActive(makeAlert({ effectiveAt: "2026-09-01T00:00:00Z" }), now), false, "not yet effective");
  assert.equal(isAlertActive(makeAlert({ expiresAt: "2026-08-01T00:00:00Z" }), now), false, "already expired");
  assert.equal(isAlertActive(makeAlert({ effectiveAt: "2026-08-01T00:00:00Z", expiresAt: "2026-09-01T00:00:00Z" }), now), true);
});

test("isAlertExpired checks only the expiration timestamp", () => {
  const now = new Date("2026-08-18T12:00:00Z");
  assert.equal(isAlertExpired(makeAlert({ expiresAt: "2026-08-01T00:00:00Z" }), now), true);
  assert.equal(isAlertExpired(makeAlert({ expiresAt: "2026-09-01T00:00:00Z" }), now), false);
  assert.equal(isAlertExpired(makeAlert({ expiresAt: null }), now), false);
});

test("an expired critical alert requiring verification keeps needing verification until someone verifies it", () => {
  const now = new Date("2026-08-18T12:00:00Z");
  const expired = makeAlert({ severity: "critical", verificationRequired: true, expiresAt: "2026-08-01T00:00:00Z" });
  assert.equal(needsVerification(expired, now), true);
  assert.equal(needsVerification({ ...expired, verifiedAt: "2026-08-15T00:00:00Z" }, now), false, "verified");
  assert.equal(needsVerification({ ...expired, archived: true }, now), false, "archived records don't need verification");
  assert.equal(needsVerification({ ...expired, verificationRequired: false }, now), false);
});

test("Respond shows active alerts plus expired-but-unverified critical alerts, never hard-hiding them", () => {
  const now = new Date("2026-08-18T12:00:00Z");
  const active = makeAlert({ id: "active" });
  const expiredVerified = makeAlert({ id: "expired-verified", expiresAt: "2026-08-01T00:00:00Z", verificationRequired: true, verifiedAt: "2026-08-10T00:00:00Z" });
  const expiredUnverified = makeAlert({ id: "expired-unverified", severity: "critical", expiresAt: "2026-08-01T00:00:00Z", verificationRequired: true });
  const expiredNoVerificationNeeded = makeAlert({ id: "expired-no-verify", expiresAt: "2026-08-01T00:00:00Z" });
  const visible = visibleInRespond([active, expiredVerified, expiredUnverified, expiredNoVerificationNeeded], now);
  assert.deepEqual(visible.map((a) => a.id).sort(), ["active", "expired-unverified"]);
});

test("alert type and severity labels are human readable", () => {
  assert.equal(alertTypeLabel("critical_warning"), "Critical Warning");
  assert.equal(alertTypeLabel("access_problem"), "Access Problem");
  assert.equal(severityLabel("critical"), "Critical");
  assert.equal(severityLabel("informational"), "Informational");
});

test("bootstrap creates the field_preplan_alerts table with severity-ordered indexing", async () => {
  const bootstrap = await readFile(new URL("../db/bootstrap.ts", import.meta.url), "utf8");
  assert.match(bootstrap, /CREATE TABLE IF NOT EXISTS field_preplan_alerts/);
  assert.match(bootstrap, /alert_type TEXT NOT NULL DEFAULT 'general_note'/);
  assert.match(bootstrap, /verification_required INTEGER NOT NULL DEFAULT 0/);
  assert.match(bootstrap, /field_preplan_alert_preplan_idx/);
});
