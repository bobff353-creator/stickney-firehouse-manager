import test from "node:test";
import assert from "node:assert/strict";
import {
  clearedForPosition,
  incomingTradeOffers,
  openScheduleSeats,
  scheduleDates,
  scheduleEligibility,
  tradeSubmission,
  upcomingAssignments,
  workspaceRequests,
} from "../app/scheduler-workspace-model.ts";

// Deliberately fictional records. These tests never connect to a live service.
const now = new Date("2026-11-20T18:00:00Z");
const employee = (id, roles = ["FF/Attendant"]) => ({
  id,
  name: `Fixture ${id}`,
  rank: "Firefighter",
  roles: JSON.stringify(roles),
});
const seat = (id, employeeId, date = "2026-11-22", role = "FF/Attendant") => ({
  id,
  employeeId,
  employeeName: employeeId,
  entryDate: date,
  role,
  status: employeeId ? "filled" : "open",
  entryId: `entry-${date}`,
  shiftTypeId: "shift",
  startTime: "06:00",
  endTime: "18:00",
  sortOrder: 0,
  isExtra: 0,
  hasTimeOverride: 0,
});
function fixture() {
  return {
    today: "2026-11-20",
    employees: [
      employee("a"),
      employee("b"),
      employee("officer", ["Officer/AO", "FF/Attendant"]),
      employee("general", []),
    ],
    slots: [
      seat("own", "a"),
      seat("return", "b", "2026-11-23"),
      seat("open", null, "2026-11-24"),
    ],
    availability: [],
    timeOff: [],
    timeOffDates: [],
    trades: [],
    claims: [],
  };
}
const offer = (extra = {}) => ({
  id: "offer",
  slotId: "own",
  returnSlotId: null,
  fromEmployeeId: "a",
  fromEmployeeName: "Fixture a",
  targetEmployeeId: null,
  acceptedByEmployeeId: null,
  status: "pending",
  entryDate: "2026-11-22",
  note: "",
  ...extra,
});

test("offers preserve recipient boundaries and acceptance state", () => {
  const data = fixture();
  data.trades = [
    offer(),
    offer({ id: "direct-other", targetEmployeeId: "officer" }),
    offer({
      id: "accepted",
      acceptedByEmployeeId: "officer",
      status: "awaiting_acceptance",
    }),
    offer({ id: "done", status: "approved" }),
  ];
  assert.deepEqual(
    incomingTradeOffers(data, "b", now).map((t) => t.id),
    ["offer"],
  );
  assert.deepEqual(incomingTradeOffers(data, "a", now), []);
  assert.deepEqual(
    workspaceRequests(data, "b").map((r) => r.id),
    [],
  );
  assert.deepEqual(
    workspaceRequests(data, "a").map((r) => r.status),
    ["offered", "offered", "pending", "approved"],
  );
});
test("coverage uses actual clearances, overlap, overnight unavailability, and active roster", () => {
  const data = fixture();
  const open = data.slots[2];
  assert.equal(scheduleEligibility(data, "b", open), null);
  assert.equal(clearedForPosition(data.employees[3], "Extra member"), true);
  assert.equal(clearedForPosition(data.employees[3], "FF/Attendant"), false);
  assert.ok(scheduleEligibility(data, "missing", open));
  data.slots.push({
    ...seat("overlap", "b", "2026-11-23"),
    startTime: "20:00",
    endTime: "08:00",
  });
  assert.match(scheduleEligibility(data, "b", open), /Already assigned/);
  data.slots.pop();
  data.availability = [
    {
      employeeId: "b",
      availabilityDate: "2026-11-23",
      status: "unavailable",
      allDay: 0,
      startTime: "20:00",
      endTime: "08:00",
    },
  ];
  assert.match(scheduleEligibility(data, "b", open), /unavailable/);
  data.availability = [];
  data.timeOff = [{ id: "off", employeeId: "b", status: "approved" }];
  data.timeOffDates = [{ requestId: "off", offDate: "2026-11-24" }];
  assert.match(scheduleEligibility(data, "b", open), /Approved time off/);
  assert.deepEqual(openScheduleSeats(data, "b", now), []);
});
test("swap requires both saved owners and both qualifications", () => {
  const data = fixture();
  data.trades = [offer({ targetEmployeeId: "b", returnSlotId: "return" })];
  assert.equal(incomingTradeOffers(data, "b", now).length, 1);
  data.slots[1].role = "Officer/AO";
  assert.equal(incomingTradeOffers(data, "b", now).length, 0);
  data.slots[1].role = "FF/Attendant";
  data.slots[1].employeeId = "officer";
  assert.equal(incomingTradeOffers(data, "b", now).length, 0);
});
test("submitted payload uses existing slot IDs and authenticated actor, never copied assignments", () => {
  const data = fixture();
  const before = JSON.stringify(data);
  assert.deepEqual(tradeSubmission(data, "a", "own", "b", "return", " note "), {
    action: "submitTrade",
    slotId: "own",
    targetEmployeeId: "b",
    returnSlotId: "return",
    tradeKind: "swap",
    note: "note",
  });
  assert.equal(JSON.stringify(data), before);
  assert.throws(
    () => tradeSubmission(data, "b", "own", "", "", ""),
    /your saved assignments/,
  );
  assert.throws(
    () => tradeSubmission(data, "a", "own", "general", "", ""),
    /cleared/,
  );
  assert.throws(
    () => tradeSubmission(data, "a", "own", "", "return", ""),
    /return shift/,
  );
});
test("source rows and inactive references remain intact when deriving the phone view", () => {
  const data = fixture();
  data.slots.push(seat("legacy", "retired-reference"));
  const before = JSON.stringify(data);
  assert.deepEqual(
    upcomingAssignments(data, "a", now).map((s) => s.id),
    ["own"],
  );
  assert.deepEqual(
    openScheduleSeats(data, "b", now).map((s) => s.id),
    ["open"],
  );
  assert.equal(JSON.stringify(data), before);
  assert.equal(
    data.slots.find((s) => s.id === "legacy").employeeId,
    "retired-reference",
  );
});
test("date requests are bounded and reject invalid or reversed dates", () => {
  assert.deepEqual(scheduleDates("2026-11-30", "2026-12-02"), [
    "2026-11-30",
    "2026-12-01",
    "2026-12-02",
  ]);
  assert.throws(() => scheduleDates("2026-02-30", "2026-03-01"));
  assert.throws(() => scheduleDates("2026-11-21", "2026-11-20"));
  assert.throws(() => scheduleDates("2026-01-01", "2026-12-31"), /93/);
});
test("overnight duty remains visible past midnight without offering started coverage", () => {
  const data = fixture();
  data.slots = [
    {
      ...seat("night", "a", "2026-11-19"),
      startTime: "18:00",
      endTime: "18:00",
    },
    {
      ...seat("old-open", null, "2026-11-19"),
      startTime: "18:00",
      endTime: "18:00",
    },
  ];
  assert.deepEqual(
    upcomingAssignments(data, "a", now).map((s) => s.id),
    ["night"],
  );
  assert.deepEqual(openScheduleSeats(data, "b", now), []);
});
