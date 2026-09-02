"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { readPortalJson } from "./portal-status";
import type { PortalPage } from "./portal-navigation";
import { formatEmployeeName } from "./employee-names";
import { formatMilitaryTime } from "./military-time";
import StaffingRotation, { type NewMember, type StaffingPerson } from "./staffing-rotation";

type Employee = { id: string; name: string; rank: string; phone?: string | null; email?: string | null; driverStatus?: string | null };
type Entry = { employeeId: string; category: string; hours: number };
type DashboardData = { viewer: { isAdmin: boolean; displayName: string; employeeId: string | null }; employees: Employee[]; entries: Entry[]; period: { startDate: string; endDate: string; status: string }; grossPayroll: number; reviewCount: number; employeeGross: number };
type Briefing = { asOf: string; currentShift: string; priorShift: string; onDuty: StaffingPerson[]; newMembers: NewMember[]; officerInCharge: string | null; staffing: { filled: number; required: number; complete: boolean }; equipmentIssues: Array<{ item: string; status: string; detail: string }>; approvals: { logs: number; payroll: number }; previousShift: { officer: string | null; note: string; calls: Array<{ reportNumber: string; timeOut: string; respondingUnits: string; address: string; callType: string }> } };

const displayName = formatEmployeeName;
function shiftLabel(value: string) { return value === "morning" ? "6:00 AM – Noon" : value === "afternoon" ? "Noon – 6:00 PM" : "6:00 PM – 6:00 AM"; }
function money(value: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value); }

export default function RoleDashboard({ data, onNavigate, allowedPages }: { data: DashboardData; onNavigate: (page: PortalPage) => void; allowedPages: readonly PortalPage[] }) {
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [briefingError, setBriefingError] = useState("");
  const [resourceCounts, setResourceCounts] = useState<{ policies: number | null; boxCards: number | null }>({ policies: null, boxCards: null });
  const [refreshing, setRefreshing] = useState(false);
  const requestInFlight = useRef(false);
  const ownEmployee = data.employees.find((employee) => employee.id === data.viewer.employeeId);
  const rank = ownEmployee?.rank.toLowerCase() ?? "";
  const isOfficer = !data.viewer.isAdmin && ["chief", "captain", "lieutenant"].some((title) => rank.includes(title));
  const role = data.viewer.isAdmin ? "Administrator" : isOfficer ? "Officer" : "Employee";

  const load = useCallback(async () => {
    if (requestInFlight.current) return;
    requestInFlight.current = true;
    setRefreshing(true);
    await Promise.all([
      readPortalJson<Briefing>("/api/dashboard", "Operational briefing unavailable").then(value => { setBriefing(value); setBriefingError(""); }).catch(() => setBriefingError("The department briefing could not refresh. Do not rely on this screen for current readiness until it reconnects.")),
      readPortalJson<{ items?: unknown[] }>("/api/resources?type=policy", "Policies unavailable").then(value => setResourceCounts(current => ({ ...current, policies: value.items?.length ?? 0 }))).catch(() => setResourceCounts(current => ({ ...current, policies: null }))),
      readPortalJson<{ items?: unknown[] }>("/api/resources?type=boxCard", "Box Cards unavailable").then(value => setResourceCounts(current => ({ ...current, boxCards: value.items?.length ?? 0 }))).catch(() => setResourceCounts(current => ({ ...current, boxCards: null }))),
    ]);
    requestInFlight.current = false;
    setRefreshing(false);
  }, []);
  useEffect(() => { const initial = window.setTimeout(() => void load(), 0); const timer = window.setInterval(() => void load(), 60000); return () => { window.clearTimeout(initial); window.clearInterval(timer); }; }, [load]);

  const ownHours = useMemo(() => data.entries.filter((entry) => entry.employeeId === ownEmployee?.id && entry.category !== "actingOfficer").reduce((sum, entry) => sum + entry.hours, 0), [data.entries, ownEmployee?.id]);
  const pending = (briefing?.approvals.logs ?? 0) + (data.viewer.isAdmin ? briefing?.approvals.payroll ?? 0 : 0);

  return <section className="role-dashboard">
    <div className="dashboard-welcome"><div><p className="eyebrow">{role} dashboard</p><h1>Department status</h1><p>Operational briefing for {displayName(data.viewer.displayName)}.</p></div><div className={`dashboard-live${briefingError ? " stale" : ""}`} role="status"><i/><strong>{briefingError ? "Update unavailable" : !briefing ? "Loading" : refreshing ? "Refreshing" : "Latest briefing"}</strong><small>{briefing ? `Last received ${new Date(briefing.asOf).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" })}` : "Status not yet verified"}</small></div></div>
    {briefingError && <div className="error-banner" role="alert"><span>{briefingError}{briefing ? " Showing the last received briefing below." : ""}</span><button disabled={refreshing} onClick={() => void load()}>{refreshing ? "Retrying…" : "Retry briefing"}</button></div>}
    <section className="chief-quick-access" aria-label="Start a common task">{([
      ["Respond", "Respond", "Open the incident map and response records"],
      ["Daily Log", "Daily Log", "Staffing, calls, and shift handoff"],
      ["Daily Duties", "Today’s duties", "See assigned station and apparatus checks"],
      ["Safety Inspections", "Safety inspections", "Complete checks and prepare reports"],
    ] as Array<[PortalPage,string,string]>).filter(([page]) => allowedPages.includes(page)).map(([page,label,detail]) => <button key={page} onClick={() => onNavigate(page)}><strong>{label}<span aria-hidden="true">→</span></strong><small>{detail}</small></button>)}</section>
    {!briefing && <div className="briefing-unavailable" role="status">{briefingError ? "Staffing, equipment, and approval status are unavailable." : "Checking staffing, equipment, and approvals…"} No all-clear is shown until records arrive.</div>}

    {briefing && <section className="command-status-grid" aria-label={briefingError ? "Last received department status — not current" : "Current department status"}>
      <StaffingRotation mode="dashboard" onDuty={briefing?.onDuty ?? []} newMembers={briefing?.newMembers ?? []} onOpenDailyLog={() => onNavigate("Daily Log")} />
      <article className="command-card oic"><header><span className="command-icon">★</span><div><small>Officer in charge</small><h2>{briefing?.officerInCharge ? displayName(briefing.officerInCharge) : "Not signed in"}</h2></div></header><p>{briefing ? shiftLabel(briefing.currentShift) : "Current shift"}</p>{!briefing?.officerInCharge && <strong className="command-warning">Officer sign-in required</strong>}</article>
      <article className={`command-card readiness ${briefing?.staffing.complete ? "is-clear" : "needs-attention"}`}><header><span className="command-icon">{briefing?.staffing.complete ? "✓" : "!"}</span><div><small>Staffing readiness</small><h2>{briefing?.staffing.complete ? "Complete" : "Needs attention"}</h2></div></header><div className="staffing-meter"><i style={{ width: `${Math.min(100, ((briefing?.staffing.filled ?? 0) / (briefing?.staffing.required || 4)) * 100)}%` }}/></div><p>{briefing?.staffing.filled ?? 0} of {briefing?.staffing.required ?? 4} positions filled{briefing?.officerInCharge ? " · OIC confirmed" : " · OIC missing"}</p></article>
      <article className={`command-card equipment ${briefing?.equipmentIssues.length ? "needs-attention" : "is-clear"}`}><header><span className="command-icon">{briefing?.equipmentIssues.length ? "!" : "✓"}</span><div><small>Equipment status</small><h2>{briefing?.equipmentIssues.length ? `${briefing.equipmentIssues.length} issue${briefing.equipmentIssues.length === 1 ? "" : "s"}` : "No issues reported"}</h2></div></header>{briefing?.equipmentIssues.length ? <ul>{briefing.equipmentIssues.map((issue) => <li key={issue.item}><strong>{issue.item}</strong> · {issue.status}{issue.detail ? ` — ${issue.detail}` : ""}</li>)}</ul> : <p>No equipment issues listed in the loaded briefing.</p>}</article>
      <article className={`command-card approvals ${pending ? "needs-attention" : "is-clear"}`}><header><span className="command-icon">{pending || "✓"}</span><div><small>Awaiting approval</small><h2>{pending ? `${pending} open item${pending === 1 ? "" : "s"}` : "All caught up"}</h2></div></header><div className="approval-lines"><button onClick={() => onNavigate("Daily Log")}><span>Log handoffs</span><strong>{briefing?.approvals.logs ?? 0}</strong></button>{data.viewer.isAdmin && <button onClick={() => onNavigate("Payroll")}><span>Payroll periods</span><strong>{briefing?.approvals.payroll ?? 0}</strong></button>}</div></article>
      <article className="command-card previous-shift"><header><span className="command-icon">↶</span><div><small>Previous shift</small><h2>{briefing ? shiftLabel(briefing.priorShift ?? "") : "Handoff summary"}</h2></div></header><blockquote>{briefing?.previousShift.note || "Loading the previous shift handoff…"}</blockquote><div><span>{briefing?.previousShift.calls.length ?? 0} calls recorded</span>{briefing?.previousShift.officer && <span>OIC: {displayName(briefing.previousShift.officer)}</span>}</div>{briefing?.previousShift.calls.slice(0, 2).map((call, index) => <p className="previous-call" key={`${call.reportNumber}-${index}`}><strong>{call.callType}</strong> {call.timeOut ? formatMilitaryTime(call.timeOut) : "Time not entered"} · {call.respondingUnits || "Units not entered"}{call.address ? ` · ${call.address}` : ""}</p>)}</article>
    </section>}

    <div className="dashboard-metrics employee-metrics"><article><span>{data.viewer.isAdmin ? "Payroll status" : "Pay period hours"}</span><strong>{data.viewer.isAdmin ? data.period.status : ownHours.toFixed(1)}</strong><small>{data.period.startDate} – {data.period.endDate}</small></article><article><span>{data.viewer.isAdmin ? "Calculated gross" : "Calculated pay"}</span><strong>{money(data.viewer.isAdmin ? data.grossPayroll : data.employeeGross)}</strong><small>Current period</small></article><article><span>Policies</span><strong>{resourceCounts.policies ?? "—"}</strong><small>Available to review</small></article><article><span>Box Cards</span><strong>{resourceCounts.boxCards ?? "—"}</strong><small>Available to search</small></article></div>
    <section className="dashboard-quick"><h2>Quick access</h2><div><button onClick={() => onNavigate(data.viewer.isAdmin ? "Payroll" : "My Timesheet")}><span>◷</span><strong>{data.viewer.isAdmin ? "Payroll" : "My Timesheet"}</strong><small>Review current hours and pay</small></button><button onClick={() => onNavigate("Policies")}><span>▤</span><strong>Policies</strong><small>Search department policies</small></button><button onClick={() => onNavigate("Box Cards")}><span>⌂</span><strong>Box Cards</strong><small>Find building response information</small></button></div></section>
  </section>;
}
