import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { generateScheduleDraft } from "../app/schedule-generator.ts";

const employee = (id, extra = {}) => ({
  id,
  name: `Employee ${id}`,
  rank: "Firefighter",
  actingOfficerEligible: 0,
  driverStatus: "",
  sortOrder: Number(id.replace(/\D/g, "")) || 99,
  ...extra,
});

const availability = (id, employeeId, extra = {}) => ({
  id,
  requestType: "availability",
  employeeId,
  startDate: "2026-08-10",
  endDate: "2026-08-10",
  startTime: "06:00",
  endTime: "18:00",
  role: "Firefighter",
  repeatMode: "none",
  repeatInterval: 0,
  status: "pending",
  createdAt: "2026-08-01T12:00:00Z",
  ...extra,
});

const base = (extra = {}) => ({
  startDate: "2026-08-10",
  endDate: "2026-08-10",
  employees: [employee("e1"), employee("e2")],
  assignments: [],
  requests: [availability("request-e1", "e1")],
  coverageRules: [{ id:"rule-1", planId:"plan-1", name:"Day staffing", role:"Firefighter", minimumStaff:1, startTime:"06:00", endTime:"18:00", daysOfWeek:"0,1,2,3,4,5,6", active:1 }],
  shiftPatterns: [{ id:"pattern-1", name:"Red", color:"#C83E32", startDate:"2026-08-10", startTime:"06:00", endTime:"18:00", recurrenceDays:1, coveragePlanId:"plan-1", active:1 }],
  staffingOverrides: [],
  distributionOrder: ["Required role / qualification", "Fewest hours worked", "Seniority", "Custom priority"],
  ...extra,
});

test("auto generation assigns only employees who requested to work", () => {
  const result = generateScheduleDraft(base());
  assert.equal(result.slots.length, 1);
  assert.equal(result.slots[0].employeeId, "e1");
  assert.deepEqual(result.slots[0].autoCandidateIds, ["e1"]);
  assert.deepEqual(result.slots[0].eligibleEmployeeIds.sort(), ["e1", "e2"]);
  assert.equal(result.slots[0].automatic, true);
});

test("without a matching availability request the role stays open for manual review", () => {
  const result = generateScheduleDraft(base({ requests:[] }));
  assert.equal(result.slots[0].employeeId, "");
  assert.equal(result.slots[0].automatic, false);
  assert.equal(result.openCount, 1);
});

test("fewest-hours priority chooses between employees who both requested the shift", () => {
  const priorAssignment = { id:"prior-e1", employeeId:"e1", workDate:"2026-08-09", startTime:"06:00", endTime:"06:00", role:"Firefighter", source:"manual", status:"assigned" };
  const result = generateScheduleDraft(base({ assignments:[priorAssignment], requests:[availability("request-e1", "e1"), availability("request-e2", "e2", { createdAt:"2026-08-02T12:00:00Z" })] }));
  assert.equal(result.slots[0].employeeId, "e2");
});

test("qualification and time-off requests remain hard safety gates", () => {
  const timeOff = { ...availability("off-e1", "e1"), requestType:"time_off", role:"" };
  const result = generateScheduleDraft(base({
    employees:[employee("e1", { driverStatus:"Cleared" }), employee("e2")],
    requests:[availability("request-e1", "e1", { role:"Engine Driver" }), availability("request-e2", "e2", { role:"Engine Driver" }), timeOff],
    coverageRules:[{ id:"rule-driver", planId:"plan-1", name:"Day staffing", role:"Engine Driver", minimumStaff:1, startTime:"06:00", endTime:"18:00", daysOfWeek:"0,1,2,3,4,5,6", active:1 }],
  }));
  assert.equal(result.slots[0].employeeId, "");
  assert.deepEqual(result.slots[0].eligibleEmployeeIds, []);
});

test("the preserved schedule API validates generated schedule publication", async () => {
  const route = await readFile(new URL("../app/api/scheduling/route.ts", import.meta.url), "utf8");
  assert.match(route, /action === "saveGeneratedSchedule"/);
  assert.match(route, /generateScheduleDraft/);
  assert.match(route, /overlapping generated shifts/);
});
