"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Employee = { id: string; name: string; rank: string; phone?: string | null; email?: string | null; driverStatus?: string | null };
type Entry = { employeeId: string; category: string; hours: number };
type DashboardData = { viewer: { isAdmin: boolean; displayName: string; employeeId: string | null }; employees: Employee[]; entries: Entry[]; period: { startDate: string; endDate: string; status: string }; grossPayroll: number; reviewCount: number; employeeGross: number };
type Briefing = { asOf: string; currentShift: string; priorShift: string; onDuty: Array<{ employeeId: string; name: string; rank: string; timeIn: string; timeOut: string; actingOfficer: number }>; officerInCharge: string | null; staffing: { filled: number; required: number; complete: boolean }; equipmentIssues: Array<{ item: string; status: string; detail: string }>; approvals: { logs: number; payroll: number }; previousShift: { officer: string | null; note: string; calls: Array<{ reportNumber: string; timeOut: string; respondingUnits: string; address: string; callType: string }> } };

function displayName(value: string) { const [last, first] = value.split(",").map((part) => part.trim()); return first ? `${first} ${last}` : value; }
function shiftLabel(value: string) { return value === "morning" ? "6:00 AM – Noon" : value === "afternoon" ? "Noon – 6:00 PM" : "6:00 PM – 6:00 AM"; }
function money(value: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value); }

export default function RoleDashboard({ data, onNavigate }: { data: DashboardData; onNavigate: (page: "Payroll" | "Daily Log" | "My Timesheet" | "Employees" | "Policies" | "Box Cards") => void }) {
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [briefingError, setBriefingError] = useState("");
  const [resourceCounts, setResourceCounts] = useState({ policies: 0, boxCards: 0 });
  const ownEmployee = data.employees.find((employee) => employee.id === data.viewer.employeeId) ?? data.employees[0];
  const rank = ownEmployee?.rank.toLowerCase() ?? "";
  const isOfficer = !data.viewer.isAdmin && ["chief", "captain", "lieutenant"].some((title) => rank.includes(title));
  const role = data.viewer.isAdmin ? "Administrator" : isOfficer ? "Officer" : "Employee";

  const load = useCallback(async () => {
    setBriefingError("");
    const [brief, policies, cards] = await Promise.all([fetch("/api/dashboard"), fetch("/api/resources?type=policy"), fetch("/api/resources?type=boxCard")]);
    const briefData = await brief.json() as Briefing & { error?: string };
    if (brief.ok) setBriefing(briefData); else setBriefingError(briefData.error || "Operational briefing unavailable");
    const policyData = await policies.json() as { items?: unknown[] }, cardData = await cards.json() as { items?: unknown[] };
    setResourceCounts({ policies: policyData.items?.length ?? 0, boxCards: cardData.items?.length ?? 0 });
  }, []);
  useEffect(() => { const initial = window.setTimeout(() => void load(), 0); const timer = window.setInterval(() => void load(), 60000); return () => { window.clearTimeout(initial); window.clearInterval(timer); }; }, [load]);

  const ownHours = useMemo(() => data.entries.filter((entry) => entry.employeeId === ownEmployee?.id && entry.category !== "actingOfficer").reduce((sum, entry) => sum + entry.hours, 0), [data.entries, ownEmployee?.id]);
  const pending = (briefing?.approvals.logs ?? 0) + (data.viewer.isAdmin ? briefing?.approvals.payroll ?? 0 : 0);

  return <section className="role-dashboard">
    <div className="dashboard-welcome"><div><p className="eyebrow">{role} dashboard</p><h1>Department status</h1><p>Live operational briefing for {displayName(data.viewer.displayName)}.</p></div><div className="dashboard-live"><i/><strong>Live</strong><small>{briefing ? `Updated ${new Date(briefing.asOf).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : "Updating…"}</small></div></div>
    {briefingError && <div className="error-banner"><span>{briefingError}</span><button onClick={() => void load()}>Retry</button></div>}

    <section className="command-status-grid" aria-label="Current department status">
      <article className="command-card on-duty"><header><span className="command-icon">●</span><div><small>Who is working now?</small><h2>{briefing?.onDuty.length ?? "—"} on duty</h2></div></header><div className="on-duty-list">{briefing?.onDuty.length ? briefing.onDuty.map((person) => <div key={person.employeeId}><span>{displayName(person.name)}{person.actingOfficer ? <b>AO</b> : null}</span><small>{person.rank} · {person.timeIn}–{person.timeOut}</small></div>) : <p>No current staffing has been entered.</p>}</div><button onClick={() => onNavigate("Daily Log")}>Open Daily Log →</button></article>
      <article className="command-card oic"><header><span className="command-icon">★</span><div><small>Officer in charge</small><h2>{briefing?.officerInCharge ? displayName(briefing.officerInCharge) : "Not signed in"}</h2></div></header><p>{briefing ? shiftLabel(briefing.currentShift) : "Current shift"}</p>{!briefing?.officerInCharge && <strong className="command-warning">Officer sign-in required</strong>}</article>
      <article className={`command-card readiness ${briefing?.staffing.complete ? "is-clear" : "needs-attention"}`}><header><span className="command-icon">{briefing?.staffing.complete ? "✓" : "!"}</span><div><small>Staffing readiness</small><h2>{briefing?.staffing.complete ? "Complete" : "Needs attention"}</h2></div></header><div className="staffing-meter"><i style={{ width: `${Math.min(100, ((briefing?.staffing.filled ?? 0) / (briefing?.staffing.required || 4)) * 100)}%` }}/></div><p>{briefing?.staffing.filled ?? 0} of {briefing?.staffing.required ?? 4} positions filled{briefing?.officerInCharge ? " · OIC confirmed" : " · OIC missing"}</p></article>
      <article className={`command-card equipment ${briefing?.equipmentIssues.length ? "needs-attention" : "is-clear"}`}><header><span className="command-icon">{briefing?.equipmentIssues.length ? "!" : "✓"}</span><div><small>Equipment status</small><h2>{briefing?.equipmentIssues.length ? `${briefing.equipmentIssues.length} issue${briefing.equipmentIssues.length === 1 ? "" : "s"}` : "No issues reported"}</h2></div></header>{briefing?.equipmentIssues.length ? <ul>{briefing.equipmentIssues.map((issue) => <li key={issue.item}><strong>{issue.item}</strong> · {issue.status}{issue.detail ? ` — ${issue.detail}` : ""}</li>)}</ul> : <p>Latest officer check reports equipment present.</p>}</article>
      <article className={`command-card approvals ${pending ? "needs-attention" : "is-clear"}`}><header><span className="command-icon">{pending || "✓"}</span><div><small>Awaiting approval</small><h2>{pending ? `${pending} open item${pending === 1 ? "" : "s"}` : "All caught up"}</h2></div></header><div className="approval-lines"><button onClick={() => onNavigate("Daily Log")}><span>Log handoffs</span><strong>{briefing?.approvals.logs ?? 0}</strong></button>{data.viewer.isAdmin && <button onClick={() => onNavigate("Payroll")}><span>Payroll periods</span><strong>{briefing?.approvals.payroll ?? 0}</strong></button>}</div></article>
      <article className="command-card previous-shift"><header><span className="command-icon">↶</span><div><small>Previous shift</small><h2>{briefing ? shiftLabel(briefing.priorShift ?? "") : "Handoff summary"}</h2></div></header><blockquote>{briefing?.previousShift.note || "Loading the previous shift handoff…"}</blockquote><div><span>{briefing?.previousShift.calls.length ?? 0} calls recorded</span>{briefing?.previousShift.officer && <span>OIC: {displayName(briefing.previousShift.officer)}</span>}</div>{briefing?.previousShift.calls.slice(0, 2).map((call, index) => <p className="previous-call" key={`${call.reportNumber}-${index}`}><strong>{call.callType}</strong> {call.timeOut || "Time not entered"} · {call.respondingUnits || "Units not entered"}{call.address ? ` · ${call.address}` : ""}</p>)}</article>
    </section>

    <div className="dashboard-metrics employee-metrics"><article><span>{data.viewer.isAdmin ? "Payroll status" : "Pay period hours"}</span><strong>{data.viewer.isAdmin ? data.period.status : ownHours.toFixed(1)}</strong><small>{data.period.startDate} – {data.period.endDate}</small></article><article><span>{data.viewer.isAdmin ? "Calculated gross" : "Calculated pay"}</span><strong>{money(data.viewer.isAdmin ? data.grossPayroll : data.employeeGross)}</strong><small>Current period</small></article><article><span>Policies</span><strong>{resourceCounts.policies}</strong><small>Available to review</small></article><article><span>Box Cards</span><strong>{resourceCounts.boxCards}</strong><small>Available to search</small></article></div>
    <section className="dashboard-quick"><h2>Quick access</h2><div><button onClick={() => onNavigate(data.viewer.isAdmin ? "Payroll" : "My Timesheet")}><span>◷</span><strong>{data.viewer.isAdmin ? "Payroll" : "My Timesheet"}</strong><small>Review current hours and pay</small></button><button onClick={() => onNavigate("Policies")}><span>▤</span><strong>Policies</strong><small>Search department policies</small></button><button onClick={() => onNavigate("Box Cards")}><span>⌂</span><strong>Box Cards</strong><small>Find building response information</small></button></div></section>
  </section>;
}
