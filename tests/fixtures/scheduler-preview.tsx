import React from "react";
import { createRoot } from "react-dom/client";
import StationScheduler from "../../app/station-scheduler";
import "../../app/globals.css";

const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
const member = { id: "fixture-member", name: "Preview Member", rank: "Firefighter", roles: '["FF/Attendant"]' };
const other = { ...member, id: "fixture-other", name: "Preview Partner" };
const shift = { id: "fixture-shift", name: "Evening crew", startTime: "18:00", endTime: "06:00", anchorDate: today, repeatEveryDays: 1, color: "gold", active: 1, sortOrder: 0 };
const slot = { id: "fixture-own", employeeId: member.id, employeeName: member.name, status: "filled", entryDate: today, startTime: "18:00", endTime: "06:00", entryId: "fixture-entry", role: "FF/Attendant", sortOrder: 0, hasTimeOverride: 0, isExtra: 0, shiftTypeId: shift.id };
const data = {
  today, viewer: { employeeId: member.id, name: member.name, rank: member.rank, roles: ["FF/Attendant"], isAdmin: true, actingOfficerEligible: false },
  employees: [member, other], roles: ["FF/Attendant"], shiftTypes: [shift], shiftTypeRoles: [], entries: [{ id: slot.entryId, entryDate: today, shiftTypeId: shift.id }],
  slots: [slot, { ...slot, id: "fixture-other-filled", employeeId: other.id, employeeName: other.name, startTime: "12:00", endTime: "18:00" }, { ...slot, id: "fixture-open", employeeId: null, employeeName: "", status: "open", startTime: "06:00", endTime: "12:00" }],
  standingAssignments: [], trades: [
    { id: "fixture-trade-ready", slotId: slot.id, returnSlotId: null, role: slot.role, fromEmployeeId: member.id, fromEmployeeName: member.name, targetEmployeeId: null, acceptedByEmployeeId: other.id, note: "Fictional accepted giveaway", status: "pending", createdAt: today, entryDate: today },
    { id: "fixture-trade-waiting", slotId: slot.id, returnSlotId: null, role: slot.role, fromEmployeeId: member.id, fromEmployeeName: member.name, targetEmployeeId: null, acceptedByEmployeeId: null, note: "Fictional waiting offer", status: "awaiting_acceptance", createdAt: today, entryDate: today },
  ], claims: [{ id: "fixture-claim-review", slotId: "fixture-open", employeeId: other.id, employeeName: other.name, role: slot.role, entryDate: today, status: "pending", note: "Fictional request", createdAt: today }] as object[], timeOff: [], timeOffDates: [], availability: [], reminderRules: [],
  otSettings: null, otTiming: { awardDaysOut: 7, completeByDaysOut: 2 }, distributionWeights: { seniorityWeight: 1, hoursWeight: 1, customWeight: 0, customLabel: "Other" },
  otInterest: [], otOffers: [], awardBySlot: {}, otStandings: {}, notice: { openShifts: 1, overdueShifts: 0, pendingTrades: 0, pendingClaims: 0, pendingTimeOff: 0 },
};
let failNextAssignment = true;
let writes = 0;
window.fetch = async (input, init) => {
  if (String(input) !== "/api/station-scheduler") throw new Error("Fixture blocks all other API requests");
  if (init?.method === "POST") {
    const body = JSON.parse(String(init.body));
    if (["assignSlot", "clearSlot"].includes(body.action)) {
      writes++;
      document.getElementById("fixture-status")!.textContent = `Fictional test only · assignment attempts: ${writes}`;
      if (failNextAssignment) { failNextAssignment = false; return Response.json({ error: "Simulated save failure. Your selection should remain available to retry." }, { status: 503 }); }
      const target = data.slots.find((row) => row.id === body.slotId)!;
      target.employeeId = body.employeeId ?? null;
      target.status = body.employeeId ? "filled" : "open";
      return Response.json({ ok: true });
    }
    if (body.action !== "submitClaim") return Response.json({ error: "Preview only: this action is not persisted." }, { status: 409 });
    data.claims.push({ id: "fixture-claim", slotId: body.slotId, role: "FF/Attendant", employeeId: member.id, employeeName: member.name, note: "", status: "pending", createdAt: today, entryDate: today });
    return Response.json({ ok: true });
  }
  return Response.json(data);
};
createRoot(document.getElementById("root")!).render(<main style={{ maxWidth: 1000, margin: "auto", padding: 12 }}><p id="fixture-status">Fictional test only · assignment attempts: 0</p><StationScheduler /></main>);
