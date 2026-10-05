"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PortalPage, PortalRecord } from "./portal-navigation";
import { readPortalJson } from "./portal-status";
import { startVisiblePolling } from "./visible-poller";
import { formatEmployeeName } from "./employee-names";
import { savedTimeLabel } from "./workflow-status";
import { shiftOverview, shiftPacketStale, type ShiftPacket } from "./shift-overview";
import "./today-dashboard.css";

const periodLabels: Record<string, string> = { morning: "0600–1200", afternoon: "1200–1800", overnight: "1800–0600" };

export default function TodayDashboard({ departmentName, allowedPages, onNavigate, showPersonalShift = true }: {
  departmentName: string; allowedPages: readonly PortalPage[];
  showPersonalShift?: boolean;
  onNavigate: (page: PortalPage, record?: PortalRecord) => void;
}) {
  const [packet, setPacket] = useState<ShiftPacket | null>(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [clock, setClock] = useState(0);
  const [severity, setSeverity] = useState("all");
  const inFlight = useRef<AbortSignal | null>(null);
  const can = (page: PortalPage) => allowedPages.includes(page);
  const load = useCallback(async (signal: AbortSignal) => {
    if (inFlight.current && !inFlight.current.aborted) return;
    inFlight.current = signal;
    setRefreshing(true);
    setClock(Date.now());
    try {
      const value = await readPortalJson<ShiftPacket>("/api/dashboard?scope=today", "Today’s shift could not load", signal);
      if (!signal.aborted) { setPacket(value); setClock(Date.now()); setError(""); }
    } catch {
      if (!signal.aborted) setError("Today could not refresh. Displayed records may be out of date. Reconnect and retry before relying on readiness.");
    } finally {
      if (inFlight.current === signal) inFlight.current = null;
      if (!signal.aborted) setRefreshing(false);
    }
  }, []);
  useEffect(() => {
    const poller = startVisiblePolling(load, 60_000);
    const timer = window.setInterval(() => setClock(Date.now()), 15_000);
    return () => { poller.stop(); window.clearInterval(timer); };
  }, [load]);
  const overview = packet ? shiftOverview(packet, allowedPages) : null;
  const stale = shiftPacketStale(packet, clock, Boolean(error));
  const attention = overview?.items.filter(item => severity === "all" || item.severity === severity) ?? [];
  const partial = overview?.parts.some(part => part.state === "unknown") || !can("Inventory") || !can("Daily Log");

  return <section className="today-workspace" data-test-safe aria-labelledby="today-title">
    <header className="today-heading"><div><p className="eyebrow">{departmentName} · Firehouse Studio</p><h1 id="today-title">Today</h1><p>{packet ? `${packet.date} · Daily Log period ${periodLabels[packet.currentShift] || packet.currentShift}` : "Your crew, current work and what needs attention."}</p></div><div className="today-received" role="status"><strong>{error || (packet && stale) ? "Update unavailable" : packet ? refreshing ? "Refreshing" : "Latest shift briefing" : "Loading shift"}</strong><span>{packet ? `Last received ${savedTimeLabel(packet.asOf)}` : "Status not yet verified"}</span><button type="button" disabled={refreshing} onClick={() => void load(new AbortController().signal)}>{refreshing ? "Refreshing…" : "Refresh"}</button></div></header>
    {error && <div className="error-banner" role="alert">{error}{packet ? " Showing the last received briefing." : ""}</div>}
    <nav className="today-actions" aria-label="Start shift work">{([
      ["Daily Log", "Start shift / Daily Log", "Staffing, calls and handoff"],
      ["Inventory", "Apparatus check", "Open due checks and saved work"],
      ["Respond", "Response", "Current calls, maps and preplans"],
      ["Daily Duties", "Station duties", "Read today’s duty instructions"],
    ] as Array<[PortalPage, string, string]>).filter(([page]) => allowedPages.includes(page)).map(([page, label, detail]) => <button type="button" key={page} onClick={() => onNavigate(page)}><strong>{label} <span aria-hidden="true">→</span></strong><small>{detail}</small></button>)}</nav>
    {!packet ? <div className="today-empty" role="status">{error ? "The shift briefing is unavailable. Use the task buttons to open your permitted tools." : "Loading the saved crew, checks and issues…"} No readiness all-clear is shown until records arrive.</div> : <>
      <div className="today-main-grid">
        <article className="today-panel today-crew"><header><div><p className="eyebrow">Who is working</p><h2>Current crew <span>{packet.onDuty.length}</span></h2></div>{can("Scheduling") && <button type="button" onClick={() => onNavigate("Scheduling")}>Schedule →</button>}</header><p className="today-source">{packet.staffingSource === "department_schedule" ? "From the department schedule" : "From saved Daily Log staffing"}{stale ? " · Last received records" : ""}</p>
          {packet.onDuty.length ? <ul>{packet.onDuty.map(person => <li key={person.employeeId}><span className="today-person-mark" aria-hidden="true">{formatEmployeeName(person.name).split(/\s+/).slice(0, 2).map(word => word[0]).join("")}</span><div><strong>{formatEmployeeName(person.name)}</strong><small>{person.rank}{person.actingOfficer ? " · Acting officer" : ""}</small></div><span>{person.timeIn || "—"}–{person.timeOut || "—"}</span></li>)}</ul> : <p className="today-empty">No crew recorded for this Daily Log period. Review the schedule or staffing log.</p>}
          <p className="today-source">Apparatus assignments are not included in this briefing.</p>
          {can("Daily Log") && <div className="today-officer"><span>Officer in charge</span><strong>{packet.officerInCharge ? formatEmployeeName(packet.officerInCharge) : "Not signed in"}</strong><button type="button" onClick={() => onNavigate("Daily Log")}>Open shift log →</button></div>}
          {showPersonalShift && can("Scheduling") && packet.nextShift && <p className="today-next-shift"><strong>Your next scheduled shift</strong><span>{packet.nextShift.workDate} · {packet.nextShift.startTime}–{packet.nextShift.endTime} · {packet.nextShift.role}</span></p>}
        </article>
        <article className="today-panel today-readiness"><header><div><p className="eyebrow">Operational readiness</p><h2>{stale ? "Current status unverified" : overview?.state === "attention" ? "Needs attention" : overview?.state === "unknown" ? "Verification incomplete" : "Loaded checks clear"}</h2></div></header><p className="today-source">Based on the saved records below. Training, certifications and supply expiration are not assessed here.</p>
          <ul>{overview?.parts.map(part => <li key={part.id}><span className={`today-status ${stale ? "unknown" : part.state}`}>{stale ? "Unverified" : part.state === "ready" ? "✓ Recorded" : part.state === "attention" ? "! Attention" : "? Unknown"}</span><div><strong>{part.label}{!stale && part.percent !== undefined ? ` · ${part.percent}%` : ""}</strong><small>{part.detail}</small></div>{part.page && <button type="button" aria-label={`Review ${part.label}`} onClick={() => onNavigate(part.page!)}>View →</button>}</li>)}</ul>
          {can("Inventory") && <details className="today-fleet"><summary>Apparatus service records</summary>{packet.fleet === null ? <p>Fleet status unavailable.</p> : packet.fleet.length ? <ul>{packet.fleet.map(unit => <li key={unit.id}><strong>{unit.name}</strong><span>{unit.status === "in_service" ? "In service" : unit.status === "out_of_service" ? "Out of service" : "Status unverified"}{stale ? " · last received" : ""}</span></li>)}</ul> : <p>No apparatus records available.</p>}</details>}
        </article>
      </div>
      <section className="today-panel today-inbox" aria-labelledby="today-inbox-title"><header><div><p className="eyebrow">Firehouse Inbox</p><h2 id="today-inbox-title">Needs attention <span>{overview?.items.length ?? 0}</span></h2></div><label>Priority <select value={severity} onChange={event => setSeverity(event.target.value)}><option value="all">All priorities</option><option value="critical">Critical</option><option value="warning">Warning</option><option value="normal">Normal</option></select></label></header><p className="today-source">{stale ? "Last received items; current status is unverified." : "Checks, reported defects, staffing and permitted approval actions."}</p>
        {attention.length ? <ul>{attention.map(item => <li key={item.id}><span className={`today-priority ${item.severity}`}>{item.severity}</span><div><small>{item.category}</small><strong>{item.title}</strong><p>{item.detail}</p></div><button type="button" aria-label={`Open ${item.title}`} onClick={() => onNavigate(item.page, item.record)}>Open →</button></li>)}</ul> : <p className="today-empty">{stale ? "Current attention items could not be verified." : severity !== "all" ? "No loaded items match this priority." : partial ? "No attention items in the available records. Some readiness sources are unverified." : "No attention items in the loaded shift briefing."}</p>}
      </section>
      {can("Respond") && packet.activeCalls && <section className={`today-panel today-calls${packet.activeCalls.length ? " has-calls" : ""}`}><header><div><p className="eyebrow">Response</p><h2>{packet.activeCalls.length} active call{packet.activeCalls.length === 1 ? "" : "s"}{stale ? " · last received" : ""}</h2></div><button type="button" onClick={() => onNavigate("Respond")}>Open Response →</button></header>{packet.activeCalls.slice(0, 3).map((call, index) => <p key={`${call.reportNumber}-${index}`}><strong>{call.callType}</strong> · {call.address || "Address not reported"}</p>)}</section>}
      {packet.previousShift && can("Daily Log") && <details className="today-panel today-handoff"><summary>Previous shift handoff{packet.previousShift.officer ? ` · ${formatEmployeeName(packet.previousShift.officer)}` : ""}</summary><p>{packet.previousShift.note}</p><button type="button" onClick={() => onNavigate("Daily Log")}>Review Daily Log →</button></details>}
    </>}
  </section>;
}
