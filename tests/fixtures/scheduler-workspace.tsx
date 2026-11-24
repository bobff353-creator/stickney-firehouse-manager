import React from "react";
import { createRoot } from "react-dom/client";
import SchedulerWorkspace from "../../app/scheduler-workspace";
import type { LiveSchedule } from "../../app/scheduler-workspace-model";
import type { SavedScheduleSafety } from "../../app/schedule-safety-store";
import { fixtureScheduleAction } from "./scheduler-fixture-actions";
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
  standingAssignments: [] as NonNullable<LiveSchedule['standingAssignments']>,
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
  claims: [] as NonNullable<LiveSchedule['claims']>,
  timeOff: [] as NonNullable<LiveSchedule['timeOff']>,
  timeOffDates: [] as NonNullable<LiveSchedule['timeOffDates']>,
  availability: [] as NonNullable<LiveSchedule['availability']>,
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
  requestDeadlines: [] as NonNullable<LiveSchedule['requestDeadlines']>,
  scheduleSafety: { revision: "fixture-safety", updatedAt: "", rules: { minimumRestHours: null, maximumContinuousHours: null } } as SavedScheduleSafety,
  pushConfigured: false,
  awardBySlot: {}, otTiming: { awardDaysOut: 7, completeByDaysOut: 2 }, otInterest: [], otOffers: [], otStandings: {},
  notice: { openShifts: 60, overdueShifts: 0, pendingTrades: 1, pendingClaims: 0, pendingTimeOff: 0 },
};
if (params.has("unified-flow")) {
  data.standingAssignments.push({ id: "fixture-standing", employeeId: employees[0].id, employeeName: employees[0].name, shiftTypeId: shift.id, role: "FF/Attendant", active: 1 });
  data.availability.push({ id: "fixture-available", employeeId: employees[2].id, employeeName: employees[2].name, updatedAt: '', availabilityDate: date(4), status: "available", allDay: 0, startTime: "06:00", endTime: "18:00", note: "" });
}
let confirmation = {version:"11111111-1111-4111-8111-111111111111",title:"Fictional confirmation",message:"Fictional message only",enabled:false};
if(params.has("long-list"))for(let n=0;n<13;n++){const row=slot('long-'+n,70+n,employees[0].id);data.slots.push(row);data.entries.push({id:row.entryId,entryDate:row.entryDate,shiftTypeId:row.shiftTypeId});}
if(params.has("legacy")){data.availability.push({id:'legacy-unavailable',employeeId:employees[0].id,employeeName:employees[0].name,availabilityDate:date(1),status:'unavailable',allDay:1,startTime:'06:00',endTime:'18:00',note:'Previously saved fictional restriction',updatedAt:''});data.timeOff.push({id:'legacy-time-off',employeeId:employees[0].id,employeeName:employees[0].name,type:'vacation',approverEmployeeId:employees[2].id,note:'Preserved fictional history',status:'approved',createdAt:date(-1)});data.timeOffDates.push({requestId:'legacy-time-off',offDate:date(-1)});}
if(params.has("clean-trades"))data.trades=data.trades.filter(t=>t.fromEmployeeId!==data.viewer.employeeId);
if(params.has("targeted"))data.trades[0].targetEmployeeId=data.viewer.employeeId;
const writes: object[] = [];
let failNext = params.has("failure");
let failRead = false, didFailRead = false, unconfirmed = params.has("unconfirmed");
window.fetch = async (input, init) => {
  const url=String(input);
  if(url.startsWith('/api/permissions'))return Response.json({effectivePermissions:['scheduling.view','scheduling.manage'],groups:[],role:'admin',requiredConfirmation:null});
  if(url.startsWith('/api/readiness-review?'))return Response.json({today,through:date(30),generatedAt:new Date().toISOString(),sources:[{group:'Crew',state:'ready',note:'Fictional saved staffing only.'}],items:Array.from({length:26},(_,i)=>({id:'signal-'+i,group:'Crew',severity:i%2?'Review':'Urgent',title:'Fictional staffing '+i,detail:'Isolated review signal',date:date(i),href:'?page=scheduling&display=portal',shiftHref:'?page=scheduling&display=portal&scheduleDate='+date(i)}))});
  if(url==='/api/required-confirmation') {
    if(init?.method==='PUT') {const draft=JSON.parse(String(init.body));writes.push({action:'saveConfirmation',...draft});document.getElementById('fixture-writes')!.textContent=JSON.stringify(writes,null,2);if(failNext){failNext=false;return Response.json({error:'Simulated confirmation save failure. Draft kept.'},{status:503});}if(draft.version!==confirmation.version)return Response.json({error:'Saved message changed.'},{status:409});confirmation={...draft,version:crypto.randomUUID()};return Response.json({ok:true,version:confirmation.version});}
    return Response.json(confirmation);
  }
  if(url!=="/api/station-scheduler")throw new Error("Fixture blocks unsupported endpoint: "+url);
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
      const open = data.slots.filter(s => s.status === "open" && s.entryDate >= body.fromDate && s.entryDate <= body.endDate);
      let assigned = 0;
      for (const position of open) {
        const eligible = employees.find(e => distributionConsent({ ...position, shiftActive: 1 }, e.id, data.availability as Parameters<typeof distributionConsent>[2], []));
        if (eligible) { Object.assign(position, { employeeId: eligible.id, employeeName: eligible.name, status: "filled" }); assigned++; }
      }
      return Response.json({ ok: true, assigned, unfilled: open.length - assigned });
    }
    try { const result=fixtureScheduleAction(data,body);if(params.has("refresh-failure")&&!didFailRead){failRead=true;didFailRead=true;}if(unconfirmed){unconfirmed=false;return Response.json({});}return Response.json(result); }
    catch(error) { return Response.json({error:error instanceof Error?error.message:'Fixture action failed.'},{status:400}); }

  }
  if(failRead){failRead=false;return Response.json({error:"Simulated refresh failure after a confirmed save."},{status:503});}
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
