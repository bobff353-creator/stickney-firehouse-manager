import assert from "node:assert/strict";
import test from "node:test";
import { roundPayrollUpToCent } from "../app/payroll-rounding.ts";

test("payroll amounts always round upward to the next cent", () => {
  assert.equal(roundPayrollUpToCent(10.001), 10.01);
  assert.equal(roundPayrollUpToCent(10.009), 10.01);
});

test("exact cent amounts are not increased", () => {
  assert.equal(roundPayrollUpToCent(10), 10);
  assert.equal(roundPayrollUpToCent(10.01), 10.01);
});

test("invalid and non-positive payroll amounts return zero", () => {
  assert.equal(roundPayrollUpToCent(0), 0);
  assert.equal(roundPayrollUpToCent(-1), 0);
  assert.equal(roundPayrollUpToCent(Number.NaN), 0);
});
