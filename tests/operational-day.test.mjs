import test from "node:test";
import assert from "node:assert/strict";
import { chicagoOperationalContext, dailyLogDateIsAutoLocked } from "../app/operational-day.ts";

test("the operational log stays on the prior date until 6:00 AM Chicago time", () => {
  const beforeSix = chicagoOperationalContext(new Date("2026-07-27T10:59:00Z"));
  assert.equal(beforeSix.operationalDate, "2026-07-26");
  assert.equal(beforeSix.lockBeforeDate, "2026-07-26");
  assert.equal(beforeSix.inLockGracePeriod, false);
});

test("the log changes at 6:00 AM and the prior date has a one-hour grace period", () => {
  const atSix = chicagoOperationalContext(new Date("2026-07-27T11:00:00Z"));
  const beforeSeven = chicagoOperationalContext(new Date("2026-07-27T11:59:00Z"));
  assert.equal(atSix.operationalDate, "2026-07-27");
  assert.equal(atSix.lockBeforeDate, "2026-07-26");
  assert.equal(atSix.inLockGracePeriod, true);
  assert.equal(beforeSeven.lockBeforeDate, "2026-07-26");
  assert.equal(dailyLogDateIsAutoLocked("2026-07-26", new Date("2026-07-27T11:59:00Z")), false);
});

test("the prior operational log locks at 7:00 AM", () => {
  const atSeven = chicagoOperationalContext(new Date("2026-07-27T12:00:00Z"));
  assert.equal(atSeven.operationalDate, "2026-07-27");
  assert.equal(atSeven.lockBeforeDate, "2026-07-27");
  assert.equal(atSeven.inLockGracePeriod, false);
  assert.equal(dailyLogDateIsAutoLocked("2026-07-26", new Date("2026-07-27T12:00:00Z")), true);
});
