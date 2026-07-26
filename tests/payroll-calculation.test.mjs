import assert from "node:assert/strict";
import test from "node:test";
import { ACTING_OFFICER_STIPEND_PER_HOUR, calculateGrossPay } from "../app/payroll-calculation.ts";

test("Acting Officer pay is a straight one-dollar stipend per AO hour", () => {
  assert.equal(ACTING_OFFICER_STIPEND_PER_HOUR, 1);
  assert.equal(calculateGrossPay({
    regularHours: 0,
    overtimeHours: 0,
    holidayHours: 0,
    actingOfficerHours: 24,
    dpwHours: 0,
    regularRate: 22,
    overtimeRate: 33,
    holidayRate: 33,
    dpwMultiplier: 1.5,
  }), 24);
});

test("AO stipend is not multiplied by overtime or holiday rates", () => {
  assert.equal(calculateGrossPay({
    regularHours: 0,
    overtimeHours: 0,
    holidayHours: 0,
    actingOfficerHours: 24,
    dpwHours: 0,
    regularRate: 100,
    overtimeRate: 150,
    holidayRate: 150,
    dpwMultiplier: 1.5,
  }), 24);
});

test("DelGatto July 11–25 regression total remains 3066.50 with 24 AO hours", () => {
  assert.equal(calculateGrossPay({
    regularHours: 0,
    overtimeHours: 0,
    holidayHours: 0,
    actingOfficerHours: 24,
    dpwHours: 0,
    regularRate: 22,
    overtimeRate: 33,
    holidayRate: 33,
    dpwMultiplier: 1.5,
  }) + 3042.5, 3066.5);
});
