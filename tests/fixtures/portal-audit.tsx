import React, { Component } from "react";
import { createRoot } from "react-dom/client";
import PayrollApp from "../../app/payroll-app";
import AuthGateway from "../../app/auth-gateway";
import ResetPasswordPage from "../../app/reset-password/page";
import AcceptInvitePage from "../../app/accept-invite/page";
import { emptyIncidentCommandState } from "../../app/incident-command-state";
import { defaultPermissionsForRank, permissionCatalog, resolveEmployeePermissions } from "../../app/permissions";
import "../../app/globals.css";
import "../../app/mobile-usability.css";
import "../../app/portal-usability.css";
import "../../app/admin-usability.css";

// Actual client UI, fictional responses only. No credentials or production writes.
const params = new URLSearchParams(location.search);
// Do not register the production offline worker in a fictional test browser.
delete Object.getPrototypeOf(navigator).serviceWorker;
const isAdmin = params.get("role") !== "member";
const allFailed = params.get("failure") === "all";
const now = new Date().toISOString();
const date = now.slice(0, 10);
const scale = { id: "firefighter", payScaleId: "firefighter", label: "Firefighter", regularRate: 20, overtimeRate: 30, holidayRate: 30 };
const employee = { ...scale, id: "fixture-member", name: "Preview, Member", rank: "Firefighter", active: 1, phone: "555-0100", email: "preview@example.invalid", employeeNumber: "FIXTURE", startDate: "2026-01-01" };
const employees = [employee, { ...employee, id: "fixture-officer", name: "Preview, Officer", rank: "Lieutenant" }];
const viewer = { email: "preview@example.invalid", isAdmin, canManageEmployees: isAdmin, canManagePayroll: isAdmin, employeeId: employee.id, displayName: employee.name, name: employee.name, canComplete: true, canManage: isAdmin };
const payroll = { viewer, employees, period: { startDate: "2026-09-11", endDate: "2026-09-25", status: "draft" }, entries: [], payScales: [scale], rateHistory: [], settings: { overtimeThreshold: 40, actingOfficerPremium: 1, dpwMultiplier: 1 } };
const policies = [{ id: "fixture-policy-1", title: "Fictional first policy", policyNumber: "001", category: "Fixture", effectiveDate: date, body: "Fictional policy text. Not department guidance." }, { id: "fixture-policy-2", title: "Fictional second policy", policyNumber: "002", category: "Fixture", effectiveDate: date, body: "Second fictional policy selected correctly." }];
const cards = [{ id: "fixture-box", title: "Fictional response card", department: "Preview department", boxNumber: "DEMO", address: "Fictional area", accessNotes: "Not operational", details: "", layoutData: "" }];
let numbers = [{ id: "fixture-phone", category: "misc", name: "Fictional test contact", emergencyNumber: "", nonEmergencyNumber: "555-0199", notes: "Do not call — fixture", sortOrder: 0 }];
let failWrite = false;
let failRead = false;
let writes = 0;
const unknown = new Set<string>();
const errors: string[] = [];
const accessRequests: string[] = [];
let accessOverrides: Record<string, Record<string, "allow" | "deny">> = {};
let accessRevision = 1;
Object.assign(window, { portalAudit: { errors, unknown, setFailWrite(value: boolean) { failWrite = value; }, setFailRead(value: boolean) { failRead = value; }, writes: () => writes } });
window.addEventListener("error", event => errors.push(event.message));
window.addEventListener("unhandledrejection", event => errors.push(String(event.reason)));
const accessEmployee = { ...employee, isAdmin: 0, loginLinked: true };
function accessPayload() {
  const memberPermissions = resolveEmployeePermissions(accessEmployee, [], Object.entries(accessOverrides[employee.id] ?? {}).map(([permissionKey,effect]) => ({permissionKey,effect})));
  return { catalog: permissionCatalog, viewerPermissions: isAdmin ? defaultPermissionsForRank("Firefighter",true) : memberPermissions, identity: "fictional:"+String(isAdmin), revision: String(accessRevision), ranks: ["Firefighter"], rankSettings: { Firefighter: defaultPermissionsForRank("Firefighter") }, overrides: accessOverrides, employees: [{ ...accessEmployee, effectivePermissions: memberPermissions }] };
}
Object.assign(window, { liveAccessAudit: { requests: accessRequests, errors, setGrant(effect?: "allow" | "deny") { accessOverrides = effect ? { [employee.id]: { "operations_board.view": effect } } : {}; accessRevision++; window.dispatchEvent(new Event("firehouse:permissions-changed")); } } });
const briefing = { asOf: now, currentShift: "morning", priorShift: "night", onDuty: [], newMembers: [], officerInCharge: null, staffing: { filled: 0, required: 4, complete: false }, equipmentIssues: [], approvals: { logs: 0, payroll: 0 }, previousShift: { officer: null, note: "Fictional handoff", calls: [] }, activeCalls: [], apparatus: [], roadClosures: [] };
const payloads: Record<string, unknown> = {
  "/api/payroll": payroll,
  "/api/permissions": { viewerPermissions: null, catalog: [{ key: "dashboard.view", label: "Home", group: "General" }], ranks: ["Firefighter"], rankSettings: { Firefighter: ["dashboard.view"] }, overrides: {}, employees: employees.map(item => ({ ...item, isAdmin: 0, effectivePermissions: ["dashboard.view", "documents.view", "scheduling.view", "inventory.view"] })) },
  "/api/alerts": { alerts: [] },
  "/api/dashboard": briefing,
  "/api/department-schedule": { items: [], upcomingShifts: [], assignments: [], shifts: [], employees: [], entries: [], slots: [] },
  "/api/command-center": { daily: [], responseTypeDaily: [], callTiming: [], staffingDetails: [], payrollDetails: [], fiscalYear: { startDate: date, endDate: date, payToDate: 0 }, generatedAt: now },
  "/api/activity": { events: [] },
  "/api/daily-duties": { items: [], canEdit: isAdmin, current: null, requiredFleetChecks: [] },
  "/api/daily-log": { log: { shiftNotes: "", locked: 0, adminUnlocked: 0, updatedAt: now, saveVersion: 1 }, staffing: [], calls: [], approvals: [], recentNotes: [], addresses: [], canUnlock: isAdmin },
  "/api/work-details": { viewer, employees, officers: [employees[1]], approvers: [employees[1]], requests: [] },
  "/api/callbacks": { submissions: [], reviewers: [employees[1]], employees: [] },
  "/api/road-closures": { closures: [], canManage: isAdmin },
  "/api/maps-config": { apiKey: "" },
  "/api/field-preplans": { preplans: [], buildings: [], features: [], photos: [], canEdit: isAdmin },
  "/api/field-hydrants": { hydrants: [], canEdit: isAdmin },
  "/api/safety-inspections": { viewer, templates: [{ id: "fixture-template", slug: "fictional", title: "Fictional safety check", description: "Preview only", cadence: "monthly", category: "Safety", locationOptions: "[]", active: 1 }], templateItems: [], inspections: [], inspection: null, results: [], attachments: [] },
  "/api/respond": { departmentId: "fixture", activeCall: null, preplan: null, match: null, cadUpdates: [], apparatusFilter: null, generatedAt: now, recentCalls: [], boxCard: null, nearestHydrants: [], operational: null, photos: [], features: [], connection: { status: "connected", label: "Fictional connection", stale: false, lastUpdatedAt: now } },
  "/api/incident-command": { incident: null, preplan: null, personnel: employees, cadUnits: [], state: null, events: [], canManage: isAdmin, connection: { status: "connected", label: "Fictional connection", stale: false, lastUpdatedAt: now }, generatedAt: now },
  "/api/digital-twin": { apparatus: [] },
  "/api/system-health": { summary: { state: "attention", label: "Fictional audit — not a live health check", checkedAt: now }, checks: [] },
  "/api/suite-context": { viewer, department: { name: "Fictional fixture" }, apparatus: [] },
  "/api/chief-board": { items: [], canEdit: isAdmin },
  "/api/payroll-corrections": { requests: [], employees, canReview: isAdmin },
  "/api/station-scheduler": {
    today: date, viewer: { ...viewer, rank: "Firefighter", roles: ["FF/Attendant"] }, employees: employees.map(item => ({ ...item, roles: '["FF/Attendant"]' })), roles: ["FF/Attendant"], dayPositionRoles: ["FF/Attendant", "Extra member"], shiftTypes: [], shiftTypeRoles: [], entries: [], slots: [], standingAssignments: [], trades: [], claims: [], timeOff: [], timeOffDates: [], availability: [], reminderRules: [], otSettings: null, otTiming: { awardDaysOut: 7, completeByDaysOut: 2 }, distributionWeights: { seniorityWeight: 1, hoursWeight: 1, customWeight: 0, customLabel: "Other" }, otInterest: [], otOffers: [], awardBySlot: {}, otStandings: {}, notice: { openShifts: 0, overdueShifts: 0, pendingTrades: 0, pendingClaims: 0, pendingTimeOff: 0 }
  },
};
payloads["/api/logbook"] = payloads["/api/daily-log"];
if (params.has("preplan-capture")) {
  // Exercise a real focused editor with a full-width message, not just the list.
  payloads["/api/permissions"] = { ...(payloads["/api/permissions"] as object), viewerPermissions: defaultPermissionsForRank("Firefighter", isAdmin), identity: "fixture:preview@example.invalid", revision: "fixture-1" };
  payloads["/api/field-preplans"] = { preplans: [], canEdit: true, imports: [{ id: "fixture-import", businessName: "Fictional footprint test — not a department record", address: "Preview address, Stickney, Illinois 60402", sourceFile: "Preview only", sourceRow: 1, status: "pending", latitude: null, longitude: null, geocodeNote: "Manual placement fixture", linkedPreplanId: null }] };
  payloads["/api/field-hydrants"] = { canEdit: true, hydrants: [{ id: "fixture-hydrant", hydrantNumber: "PREVIEW ONLY", address: "Fictional water supply", latitude: 41.8189, longitude: -87.7734, serviceStatus: "in_service", manufacturer: "", model: "", portCount: 2, portSizes: [], notes: "Not operational", flushes: [], flowTests: [] }] };
}
if (params.has("active-command")) {
  const state = emptyIncidentCommandState();
  state.units["PREVIEW ENGINE"] = { assignment: "Staging", status: "Staged", floor: "Level unknown", side: "", crewStrength: 4 };
  payloads["/api/incident-command"] = { ...(payloads["/api/incident-command"] as object), state, cadUnits: ["PREVIEW ENGINE"], incident: { incidentId: "fictional-incident", reportNumber: "PREVIEW ONLY", callType: "Fictional training fixture", address: "Not a real incident", city: "Preview", dispatchedAt: now, receivedAt: now, source: "Fictional audit" } };
}
window.fetch = async (input, init) => {
  const url = new URL(String(input), location.origin);
  const method = init?.method ?? "GET";
  if (params.has("live-access")) {
    accessRequests.push(url.pathname+url.search);
    if (url.pathname === "/api/permissions") {
      if (method === "PUT") {
        if (failWrite) { failWrite = false; return Response.json({error:"Simulated failed save"},{status:503}); }
        const body=JSON.parse(String(init?.body || "{}"));
        if (body.revision !== String(accessRevision)) return Response.json({error:"Stale fixture editor"},{status:409});
        accessOverrides={...accessOverrides,[body.employeeId]:body.overrides};accessRevision++;
        return Response.json({saved:true});
      }
      return Response.json(accessPayload());
    }
    if (url.pathname === "/api/board-feeds") return Response.json({feeds:[],checkedAt:now});
    if (url.searchParams.get("scope") === "live-operations" && !accessPayload().viewerPermissions.includes("operations_board.view")) return Response.json({error:"Individual board access required"},{status:403});
  }
  if (!["GET", "HEAD"].includes(method)) {
    writes++;
    if (failWrite) { failWrite = false; throw new Error("Simulated connection loss during save"); }
    const body = JSON.parse(String(init?.body || "{}"));
    if (url.pathname === "/api/payroll" && body.action === "saveEmployee") return Response.json({ id: body.id || "fixture-new" });
    if (url.pathname === "/api/payroll" && body.action === "setPeriodStatus") return Response.json({ ok: true });
    if (url.pathname === "/api/phone-numbers") {
      if (body.action === "delete") numbers = numbers.filter(item => item.id !== body.id);
      return Response.json({ ok: true });
    }
    if (url.pathname === "/api/resources") return Response.json({ ok: true });
    return Response.json({ error: "Fictional audit: writes blocked for this workflow." }, { status: 409 });
  }
  if (url.origin !== location.origin) return Response.json([]); // Block Supabase/third-party access too.
  if ((allFailed && !["/api/payroll", "/api/permissions", "/api/alerts"].includes(url.pathname)) || failRead) return Response.json({ error: "Simulated service unavailable" }, { status: 503 });
  if (url.pathname === "/api/resources") return Response.json({ canEdit: isAdmin, items: url.searchParams.get("type") === "policy" ? policies : cards });
  if (url.pathname === "/api/phone-numbers") return Response.json({ numbers, canEdit: isAdmin });
  if (payloads[url.pathname]) return Response.json(payloads[url.pathname]);
  unknown.add(url.pathname);
  return Response.json({ error: "This service is intentionally unavailable in the fictional audit." }, { status: 503 });
};
class Boundary extends Component<{ children: React.ReactNode }, { error: string }> {
  state = { error: "" };
  componentDidCatch(error: Error, info: React.ErrorInfo) { errors.push(`${error.stack}\n${info.componentStack}`); }
  static getDerivedStateFromError(error: Error) { errors.push(error.message); return { error: error.message }; }
  render() { return this.state.error ? <p role="alert">AUDIT RENDER ERROR: {this.state.error}</p> : this.props.children; }
}
createRoot(document.getElementById("root")!).render(<Boundary><div style={{ padding: 6, background: "#ffecb5", color: "#12354a", textAlign: "center", fontSize: 13 }}>Fictional local audit · {isAdmin ? "Administrator" : "Member"} · No real records</div>{params.get("screen") === "sign-in" ? <AuthGateway /> : params.get("screen") === "reset-password" ? <ResetPasswordPage /> : params.get("screen") === "accept-invite" ? <AcceptInvitePage /> : <PayrollApp accountEmail="preview@example.invalid" onSignOut={() => { location.href = "./portal-audit.html"; }} />}</Boundary>);
