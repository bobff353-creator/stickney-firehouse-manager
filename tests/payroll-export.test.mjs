import assert from "node:assert/strict";
import test from "node:test";
import { payrollExportRows } from "../app/payroll-export.ts";

test("export separates regular, overtime, and AO stipend rows like the reference payroll", () => {
  const rows = payrollExportRows({
    name: "DelGatto, Eric",
    rank: "Firefighter",
    regularRate: 23,
    overtimeRate: 34.5,
    holidayRate: 34.5,
  }, [
    { category: "shift", hours: 123 },
    { category: "actingOfficer", hours: 42 },
  ], 106, 1.5);

  assert.deepEqual(rows, [
    ["DelGatto, Eric", "Firefighter", 123, 0, 0, 0, 0, 0, 106, "23.00", "2438.00"],
    ["DelGatto, Eric (Overtime)", "Firefighter Overtime", 0, 0, 0, 0, 0, 0, 17, "34.50", "586.50"],
    ["DelGatto, Eric (Acting Officer)", "Acting Officer", 0, 0, 0, 0, 42, 0, 42, "1.00", "42.00"],
  ]);
});

test("export keeps detailed work categories in the regular employee row", () => {
  const rows = payrollExportRows({
    name: "Wyant, Robert",
    rank: "Lieutenant",
    regularRate: 26.5,
    overtimeRate: 39.75,
    holidayRate: 39.75,
  }, [
    { category: "shift", hours: 43 },
    { category: "workDetail", hours: 4.5 },
  ], 106, 1.5);

  assert.deepEqual(rows[0].slice(0, 9), ["Wyant, Robert", "Lieutenant", 43, 0, 4.5, 0, 0, 0, 47.5]);
  assert.equal(rows[0][10], "1318.38", "Work Detail uses the premium rate in payroll exports");
});

test("Captain Work Detail exports at the Captain straight-time rate", () => {
  const rows = payrollExportRows({
    name: "Anderson, Jacob",
    rank: "Captain",
    regularRate: 28.94,
    overtimeRate: 43.41,
    holidayRate: 43.41,
  }, [
    { category: "shift", hours: 66 },
    { category: "workDetail", hours: 7 },
  ], 106, 1.5);

  assert.equal(rows[0][10], "2112.62");
});
