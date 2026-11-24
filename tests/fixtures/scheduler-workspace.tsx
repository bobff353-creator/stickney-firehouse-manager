import React from "react";
import { createRoot } from "react-dom/client";
import SchedulerWorkspace from "../../app/scheduler-workspace";
import { distributionConsent } from "../../app/station-distribution";
import { WorkspaceViewMemory } from "../../app/workspace-view-state";
import "../../app/globals.css";
import "../../app/portal-contrast.css";

const today = new Date().toLocaleDateString("en-CA", {
  timeZone: "America/Chicago",
});
function date(n: number) {
  const value = new Date(today + "T12:00:00Z");
  value.setUTCDate(value.getUTCDate() + n);
  return value.toISOString().slice(0, 10);
}
const roles = [
  "Officer/AO",
  "Engine Driver",
  "Ambulance Driver",
  "FF/Attendant",
];
const employees = [
  {
    id: "fixture-member",
    name: "Fixture Member",
    rank: "Lieutenant",
    roles: JSON.stringify(roles),
  },
  {
    id: "fixture-partner",
    name: "Fixture Partner",
    rank: "Firefighter",
    roles: JSON.stringify(["FF/Attendant"]),
  },
  {
    id: "fixture-officer",
    name: "Fixture Officer",
    rank: "Captain",
    roles: JSON.stringify(roles),
  },
  {
    id: "fixture-general",
    name: "Fixture General",
    rank: "Single role",
    roles: "[]",
  },
];
const shift = {
  id: "fixture-shift",
  name: "Fixture day group",
  startTime: "06:00",
  endTime: "18:00",
  anchorDate: today,
  repeatEveryDays: 1,
  color: "gold",
  active: 1,
  sortOrder: 0,
};
function slot(id: string, n: number, employeeId: string | null) {
  return {
    id,
    entryId: "entry-" + n,
    entryDate: date(n),
    shiftTypeId: shift.id,
    role: "FF/Attendant",
    employeeId,
    employeeName: employees.find((e) => e.id === employeeId)?.name || "",
    status: employeeId ? "filled" : "open",
    sortOrder: 0,
    startTime: "06:00",
    endTime: "18:00",
    isExtra: 0,
    hasTimeOverride: 0,
  };
}
const slots = [
  slot("own", 1, "fixture-member"),
  slot("offered", 2, "fixture-partner"),
  slot("return", 3, "fixture-partner"),
  ...Array.from({ length: 60 }, (_, i) => slot("open-" + i, i + 4, null)),
];
const params = new URLSearchParams(location.search);
const data = {
  today,
  viewer: {
    employeeId: "fixture-member",
    name: "Fixture Member",
    rank: "Lieutenant",
    roles,
    isAdmin: !params.has("member"),
    actingOfficerEligible: false,
  },
  roles,
  dayPositionRoles: [
    ...roles,
    "Extra member",
    "Firefighter",
    "Training/Orientation",
  ],
  employees,
  shiftTypes: [shift],
  shiftTypeRoles: roles.map((role, i) => ({
    id: "req-" + i,
    shiftTypeId: shift.id,
    role,
    count: 1,
  })),
  entries: slots.map((s) => ({
    id: s.entryId,
    entryDate: s.entryDate,
    shiftTypeId: shift.id,
  })),
  slots,
  standingAssignments: [] as object[],
  trades: [
    {
      id: "broadcast",
      slotId: "offered",
      returnSlotId: null,
      role: "FF/Attendant",
      fromEmployeeId: "fixture-partner",
      fromEmployeeName: "Fixture Partner",
      targetEmployeeId: null,
      acceptedByEmployeeId: null,
      status: "pending",
      createdAt: today,
      entryDate: date(2),
      note: "Fictional trade offer",
    },
    {
      id: "ready",
      slotId: "own",
      returnSlotId: null,
      role: "FF/Attendant",
      fromEmployeeId: "fixture-member",
      fromEmployeeName: "Fixture Member",
      targetEmployeeId: "fixture-officer",
      acceptedByEmployeeId: "fixture-officer",
      status: "awaiting_acceptance",
      createdAt: today,
      entryDate: date(1),
      note: "Fictional accepted offer",
    },
  ],
  claims: [] as object[],
  timeOff: [] as object[],
  timeOffDates: [] as object[],
  availability: [] as object[],
  reminderRules: [
    {
      id: "fixture-rule",
      type: "open_shift",
      label: "Open positions",
      offsets: '["immediate","1 day before"]',
      pushEnabled: 1,
      emailEnabled: 0,
      textEnabled: 0,
      target: "",
      enabled: 1,
    },
  ],
  requestDeadlines: [] as object[],
  pushConfigured: false,
  awardBySlot: {}, otTiming: { awardDaysOut: 7, completeByDaysOut: 2 }, otInterest: [], otOffers: [], otStandings: {},
  notice: { openShifts: 60, overdueShifts: 0, pendingTrades: 1, pendingClaims: 0, pendingTimeOff: 0 },
};
if (params.has("unified-flow")) {
  data.standingAssignments.push({ id: "fixture-standing", employeeId: employees[0].id, employeeName: employees[0].name, shiftTypeId: shift.id, role: "FF/Attendant", active: 1 });
  data.availability.push({ id: "fixture-available", employeeId: employees[2].id, availabilityDate: date(4), status: "available", allDay: 0, startTime: "06:00", endTime: "18:00", note: "" });
}
const writes: object[] = [];
let failNext = params.has("failure");
window.fetch = async (input, init) => {
  if (String(input) !== "/api/station-scheduler")
    throw new Error("Fixture blocks every other endpoint");
  if (init?.method === "POST") {
    const body = JSON.parse(String(init.body));
    writes.push(body);
    document.getElementById("fixture-writes")!.textContent = JSON.stringify(
      writes,
      null,
      2,
    );
    if (failNext) {
      failNext = false;
      return Response.json(
        { error: "Simulated connection failure. Your selections are kept." },
        { status: 503 },
      );
    }
    if (body.action === "runAutoDistribution" && params.has("unified-flow")) {
      const open = slots.filter(s => s.status === "open" && s.entryDate >= body.fromDate && s.entryDate <= body.endDate);
      let assigned = 0;
      for (const position of open) {
        const eligible = employees.find(e => distributionConsent({ ...position, shiftActive: 1 }, e.id, data.availability as Parameters<typeof distributionConsent>[2], []));
        if (eligible) { Object.assign(position, { employeeId: eligible.id, employeeName: eligible.name, status: "filled" }); assigned++; }
      }
      return Response.json({ ok: true, assigned, unfilled: open.length - assigned });
    }
    if (body.action === "respondTrade") {
      const trade = data.trades.find((t) => t.id === body.id)!;
      Object.assign(trade, {
        acceptedByEmployeeId: data.viewer.employeeId,
        status: "awaiting_acceptance",
      });
    }
    if (body.action === "submitTrade") {
      data.trades.push({
        id: "created-" + writes.length,
        slotId: body.slotId,
        returnSlotId: body.returnSlotId,
        role: "FF/Attendant",
        fromEmployeeId: data.viewer.employeeId,
        fromEmployeeName: data.viewer.name,
        targetEmployeeId: body.targetEmployeeId || null,
        acceptedByEmployeeId: null,
        status: body.targetEmployeeId ? "awaiting_acceptance" : "pending",
        createdAt: today,
        entryDate: slots.find((s) => s.id === body.slotId)!.entryDate,
        note: body.note,
      });
    }
    if (body.action === "submitClaim")
      data.claims.push({
        id: "claim-" + writes.length,
        slotId: body.slotId,
        employeeId: data.viewer.employeeId,
        employeeName: data.viewer.name,
        role: "FF/Attendant",
        entryDate: slots.find((s) => s.id === body.slotId)!.entryDate,
        status: "pending",
        note: body.note,
      });
    if (body.action === "reviewTrade") {
      const trade = data.trades.find((t) => t.id === body.id)!;
      trade.status = body.decision;
    }
    if (["assignSlot", "clearSlot"].includes(body.action)) {
      const s = slots.find((s) => s.id === body.slotId)!;
      Object.assign(s, {
        employeeId: body.employeeId || null,
        employeeName:
          employees.find((e) => e.id === body.employeeId)?.name || "",
        status: body.employeeId ? "filled" : "open",
      });
    }
    return Response.json({ ok: true, note: "Saved in isolated fixture only." });
  }
  return Response.json(data);
};
createRoot(document.getElementById("root")!).render(
  <WorkspaceViewMemory>
    <p style={{ padding: 12, background: "#fff2b0", color: "#111" }}>
      LOCAL TEST ONLY — fictional records. No production requests.
    </p>
    <div className="app-shell sidebar-collapsed">
      <main
        className="workspace"
        style={{ maxWidth: 1060, margin: "auto", padding: 16 }}
      >
        <div id="portal-workspace">
          <SchedulerWorkspace
            testMember={
              params.has("preview")
                ? { ...employees[0], effectivePermissions: [] }
                : null
            }
          />
        </div>
      </main>
    </div>
    <details>
      <summary>Fixture requests</summary>
      <pre id="fixture-writes">[]</pre>
    </details>
  </WorkspaceViewMemory>,
);
