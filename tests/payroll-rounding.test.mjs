import assert from "node:assert/strict";
import test from "node:test";
import { roundPayrollToCent } from "../app/payroll-rounding.ts";

test("payroll amounts round to the nearest hundredth", () => {
  assert.equal(roundPayrollToCent(10.001), 10);
  assert.equal(roundPayrollToCent(10.004), 10);
  assert.equal(roundPayrollToCent(10.005), 10.01);
  assert.equal(roundPayrollToCent(10.009), 10.01);
});

test("exact cent amounts are not increased", () => {
  assert.equal(roundPayrollToCent(10), 10);
  assert.equal(roundPayrollToCent(10.01), 10.01);
  assert.equal(roundPayrollToCent(66 * 28.94 + 7 * 28.94), 2112.62);
});

test("invalid and non-positive payroll amounts return zero", () => {
  assert.equal(roundPayrollToCent(0), 0);
  assert.equal(roundPayrollToCent(-1), 0);
  assert.equal(roundPayrollToCent(Number.NaN), 0);
});
