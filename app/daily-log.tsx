"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type LogEmployee = { id: string; name: string; rank: string; startDate?: string | null; endDate?: string | null };
type StaffingRow = { id: string; shiftKey: string; employeeId: string; timeIn: string; timeOut: string; actingOfficer: boolean };
type CallRow = { id: string; reportNumber: string; timeOut: string; timeIn: string; respondingUnits: string; address: string; callType: string };
type Approval = { shiftKey: string; signInOfficerId?: string; signInAt?: string; signOutOfficerId?: string; signOutAt?: string; signOutNote?: string };
type RecentNote = { logDate: string; note: string };
type LogPayload = { log: { shiftNotes: string; locked: number; adminUnlocked: number; updatedAt: string }; staffing: StaffingRow[]; calls: CallRow[]; approvals: Approval[]; recentNotes: RecentNote[]; addresses: string[]; error?: string };
type Handoff = { shiftKey: string; shiftTitle: string; mode: "in" | "out" };

const shiftSections = [
  { key: "morning", title: "6:00 AM – Noon", defaultIn: "06:00", defaultOut: "12:00" },
  { key: "afternoon", title: "Noon – 6:00 PM", defaultIn: "12:00", defaultOut: "18:00" },
  { key: "overnight", title: "6:00 PM – 6:00 AM", defaultIn: "18:00", defaultOut: "06:00" },
];
const equipmentItems = [
  { key: "knox", name: "Knox Box keys", detail: "Verify all Knox Box keys are in place." },
  { key: "radios", name: "Portable radios", detail: "Units 1201, 1203, 1204, 1205, and 1207" },
  { key: "phones", name: "Cell phones", detail: "Units 1203, 1205, and 1207" },
  { key: "tics", name: "Thermal imaging cameras", detail: "Units 1201, 1203, and 1204" },
  { key: "sensit", name: "Sensit gas detectors", detail: "Units 1203 and 1204" },
];
const callTypes = ["Fire", "EMS", "MVA", "TRT", "HazMat", "Auto Aid", "Mutual Aid", "Hazardous Condition", "Special"];
const timeOptions = Array.from({ length: 96 }, (_, index) => {
  const hours = Math.floor(index / 4), minutes = (index % 4) * 15;
  const value = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  return { value, label: `${hours % 12 || 12}:${String(minutes).padStart(2, "0")} ${hours < 12 ? "AM" : "PM"}` };
});
const cleanEquipment = () => Object.fromEntries(equipmentItems.map((item) => [item.key, { status: "Present", detail: "" }])) as Record<string, { status: string; detail: string }>;

function localDate() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
function nowTime() { const d = new Date(); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; }
function clientId() { return `row-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`; }
function blankStaff(shiftKey: string, timeIn: string, timeOut: string, actingOfficer = false): StaffingRow { return { id: clientId(), shiftKey, employeeId: "", timeIn, timeOut, actingOfficer }; }
function blankCall(): CallRow { return { id: clientId(), reportNumber: "", timeOut: "", timeIn: "", respondingUnits: "", address: "", callType: "EMS" }; }
function displayName(value: string) { const [last, first] = value.split(",").map((part) => part.trim()); return first ? `${first} ${last}` : value; }
function isOfficer(employee?: LogEmployee) { return Boolean(employee && /chief|captain|lieutenant/i.test(employee.rank)); }
function shiftMinutes(value: string, shiftKey: string) { const [hours, minutes] = value.split(":").map(Number); const total = hours * 60 + minutes; return shiftKey === "overnight" && total <= 360 ? total + 1440 : total; }

export default function DailyLog({ employees, onPayrollSynced }: { employees: LogEmployee[]; onPayrollSynced?: () => void }) {
  const [logDate, setLogDate] = useState(localDate);
  const [staffing, setStaffing] = useState<StaffingRow[]>([]);
  const [calls, setCalls] = useState<CallRow[]>([]);
  const [shiftNotes, setShiftNotes] = useState("");
  const [addresses, setAddresses] = useState<string[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [recentNotes, setRecentNotes] = useState<RecentNote[]>([]);
  const [locked, setLocked] = useState(false);
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState("");
  const [handoff, setHandoff] = useState<Handoff | null>(null);
  const [officerId, setOfficerId] = useState("");
  const [equipment, setEquipment] = useState(cleanEquipment);
  const [handoffNote, setHandoffNote] = useState("");
  const [reviewedNotes, setReviewedNotes] = useState(false);
  const [acceptedNotes, setAcceptedNotes] = useState(false);
  const loaded = useRef(false);
  const currentDay = useRef(localDate());
  const readOnly = locked && !adminUnlocked;

  const loadLog = useCallback(async (date: string) => {
    setLoading(true); setMessage(""); loaded.current = false;
    try {
      const response = await fetch(`/api/logbook?date=${date}`); const data = await response.json() as LogPayload;
      if (!response.ok) throw new Error(data.error || "Unable to load log");
      const rows = data.staffing.map((row) => ({ ...row, actingOfficer: Boolean(row.actingOfficer) }));
      for (const shift of shiftSections) for (let i = rows.filter((row) => row.shiftKey === shift.key).length; i < 4; i += 1) rows.push(blankStaff(shift.key, shift.defaultIn, shift.defaultOut));
      setStaffing(rows); setCalls(data.calls.length ? data.calls : Array.from({ length: 4 }, blankCall)); setShiftNotes(data.log?.shiftNotes ?? "");
      setAddresses(data.addresses ?? []); setApprovals(data.approvals ?? []); setRecentNotes(data.recentNotes ?? []);
      setLocked(Boolean(data.log?.locked)); setAdminUnlocked(Boolean(data.log?.adminUnlocked)); setDirty(false);
      window.setTimeout(() => { loaded.current = true; }, 0);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to load log"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { const timer = window.setTimeout(() => { void loadLog(logDate); }, 0); return () => window.clearTimeout(timer); }, [loadLog, logDate]);
  useEffect(() => { const timer = window.setInterval(() => { const today = localDate(); if (today !== currentDay.current) { currentDay.current = today; setLogDate(today); } }, 30000); return () => window.clearInterval(timer); }, []);

  const saveLog = useCallback(async (silent = false) => {
    if (!loaded.current || readOnly) return;
    setSaving(true); if (!silent) setMessage("");
    try {
      const response = await fetch("/api/logbook", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ logDate, staffing: staffing.filter((row) => row.employeeId), calls: calls.filter((row) => Object.entries(row).some(([key, value]) => key !== "id" && value && value !== "EMS")), shiftNotes }) });
      const result = await response.json() as { error?: string; payrollEmployeesUpdated?: number }; if (!response.ok) throw new Error(result.error || "Unable to save log");
      setDirty(false); setMessage(silent ? "All changes saved · Timesheets updated" : "Daily log and timesheets saved"); onPayrollSynced?.();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to save log"); }
    finally { setSaving(false); }
  }, [calls, logDate, onPayrollSynced, readOnly, shiftNotes, staffing]);
  useEffect(() => { if (!dirty || readOnly) return; const timer = window.setTimeout(() => { void saveLog(true); }, 900); return () => window.clearTimeout(timer); }, [dirty, readOnly, saveLog]);

  const activeEmployees = useMemo(() => employees.filter((employee) => (!employee.startDate || employee.startDate <= logDate) && (!employee.endDate || employee.endDate >= logDate)), [employees, logDate]);
  const markDirty = () => { if (loaded.current) setDirty(true); };
  function clockValue(total: number) { const normalized = total % 1440; return `${String(Math.floor(normalized / 60)).padStart(2, "0")}:${String(normalized % 60).padStart(2, "0")}`; }
  function reconcileActingOfficer(input: StaffingRow[], shiftKey: string) {
    let rows = input.map((row) => ({ ...row }));
    const shift = shiftSections.find((item) => item.key === shiftKey);
    if (!shift) return rows;
    const staffed = rows.filter((row) => row.shiftKey === shiftKey && row.employeeId && !row.actingOfficer);
    if (staffed.length === 0) return rows;
    const start = shiftMinutes(shift.defaultIn, shiftKey), end = shiftMinutes(shift.defaultOut, shiftKey);
    const officerCoverage = staffed.filter((row) => isOfficer(activeEmployees.find((employee) => employee.id === row.employeeId))).map((row) => ({ start: Math.max(start, shiftMinutes(row.timeIn, shiftKey)), end: Math.min(end, shiftMinutes(row.timeOut, shiftKey)) })).filter((range) => range.end > range.start).sort((a, b) => a.start - b.start);
    const gaps: Array<{ start: number; end: number }> = [];
    let cursor = start;
    for (const coverage of officerCoverage) { if (coverage.start > cursor) gaps.push({ start: cursor, end: coverage.start }); cursor = Math.max(cursor, coverage.end); }
    if (cursor < end) gaps.push({ start: cursor, end });
    const existing = rows.find((row) => row.shiftKey === shiftKey && row.actingOfficer);
    rows.filter((row) => row.shiftKey === shiftKey && row.actingOfficer && row.id !== existing?.id).forEach((row) => { row.actingOfficer = false; });
    if (gaps.length === 0) {
      if (existing?.employeeId) existing.actingOfficer = false;
      else if (existing) rows = rows.filter((row) => row.id !== existing.id);
      return rows;
    }
    const gap = gaps[0];
    if (existing) { existing.timeIn = clockValue(gap.start); existing.timeOut = clockValue(gap.end); }
    else rows.push(blankStaff(shiftKey, clockValue(gap.start), clockValue(gap.end), true));
    return rows;
  }
  function selectStaffEmployee(id: string, employeeId: string) {
    setStaffing((current) => {
      let rows = current.map((row) => row.id === id ? { ...row, employeeId } : { ...row });
      const target = rows.find((row) => row.id === id);
      if (!target) return rows;
      if (target.actingOfficer && isOfficer(activeEmployees.find((employee) => employee.id === employeeId))) target.actingOfficer = false;
      if (employeeId) {
        const targetStart = shiftMinutes(target.timeIn, target.shiftKey), targetEnd = shiftMinutes(target.timeOut, target.shiftKey);
        for (const other of rows) {
          if (other.id === id || other.employeeId !== employeeId) continue;
          const otherStart = shiftMinutes(other.timeIn, other.shiftKey), otherEnd = shiftMinutes(other.timeOut, other.shiftKey);
          if (otherStart <= targetStart && targetStart < otherEnd) other.timeOut = target.timeIn;
          else if (targetStart <= otherStart && otherStart < targetEnd) target.timeOut = other.timeIn;
        }
      }
      rows = reconcileActingOfficer(rows, target.shiftKey);
      return rows;
    });
    markDirty();
  }
  function setStaffTimeIn(id: string, timeIn: string) {
    setStaffing((current) => { const rows = current.map((row) => row.id === id ? { ...row, timeIn } : { ...row }); const target = rows.find((row) => row.id === id); return target ? reconcileActingOfficer(rows, target.shiftKey) : rows; });
    markDirty();
  }
  function setStaffTimeOut(id: string, timeOut: string) {
    setStaffing((current) => {
      const rows = current.map((row) => row.id === id ? { ...row, timeOut } : { ...row });
      const target = rows.find((row) => row.id === id);
      return target ? reconcileActingOfficer(rows, target.shiftKey) : rows;
    });
    markDirty();
  }
  function updateCall(id: string, patch: Partial<CallRow>) { setCalls((rows) => rows.map((row) => row.id === id ? { ...row, ...patch } : row)); markDirty(); }
  function openHandoff(shiftKey: string, shiftTitle: string, mode: "in" | "out") { setHandoff({ shiftKey, shiftTitle, mode }); setOfficerId(""); setEquipment(cleanEquipment()); setHandoffNote(""); setReviewedNotes(recentNotes.length === 0); setAcceptedNotes(false); }
  async function submitHandoff() {
    if (!handoff) return;
    const hasIssueWithoutDetail = Object.values(equipment).some((item) => item.status !== "Present" && !item.detail.trim());
    if (!officerId) return setMessage("Select the officer completing the approval.");
    if (handoff.mode === "in" && (!reviewedNotes || !acceptedNotes)) return setMessage("Scroll through and accept the previous seven days of notes.");
    if (hasIssueWithoutDetail) return setMessage("Add details for all missing or out-of-service equipment.");
    if (Object.values(equipment).some((item) => item.status !== "Present") && !handoffNote.trim()) return setMessage("Add a handoff note for the equipment issue.");
    const response = await fetch("/api/logbook", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "handoff", logDate, shiftKey: handoff.shiftKey, mode: handoff.mode, officerId, equipment, note: handoffNote, reviewedNotes: handoff.mode === "in" ? reviewedNotes && acceptedNotes : true }) });
    const result = await response.json() as { error?: string }; if (!response.ok) return setMessage(result.error || "Unable to save approval");
    const successMessage = handoff.mode === "in" ? "Officer signed in and equipment approved" : "Officer signed out and shift approved";
    setHandoff(null); await loadLog(logDate); setMessage(successMessage);
  }
  async function adminUnlock() { const response = await fetch("/api/logbook", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "adminUnlock", logDate }) }); if (response.ok) { setAdminUnlocked(true); setMessage("Administrator edit access granted"); } }

  if (loading) return <section className="content-card log-loading">Loading daily log…</section>;
  return <section className="logbook-page">
    <div className="logbook-heading"><div><p className="eyebrow">Stickney Fire Department</p><h2>Daily Logbook</h2><p>Automatically saved staffing, responses, equipment checks, and officer handoffs.</p></div><div className="log-date-actions"><label><span>Log date</span><input type="date" value={logDate} onChange={(event) => setLogDate(event.target.value)} /></label><div className={`autosave-state ${dirty ? "pending" : ""}`}>{saving ? "Saving…" : dirty ? "Save pending" : "✓ Auto-saved"}</div></div></div>
    {readOnly && <div className="locked-banner"><div><strong>🔒 Daily log locked</strong><span>Logs lock automatically after midnight. Editing requires administrator approval.</span></div><button onClick={() => void adminUnlock()}>Admin Unlock</button></div>}
    {adminUnlocked && locked && <div className="admin-banner">Administrator editing is enabled for this locked log.</div>}
    {message && <div className={message.includes("saved") || message.includes("approved") || message.includes("granted") ? "log-message success" : "log-message"}>{message}</div>}

    <fieldset className="logbook-fields" disabled={readOnly}>
      <div className="shift-card-grid">{shiftSections.map((shift) => { const rows = staffing.filter((row) => row.shiftKey === shift.key); const approval = approvals.find((item) => item.shiftKey === shift.key); return <article className="content-card shift-card" key={shift.key}>
        <div className="shift-title"><div><span>Staffing</span><h3>{shift.title}</h3></div><button aria-label={`Add person to ${shift.title}`} onClick={() => { setStaffing((current) => [...current, blankStaff(shift.key, shift.defaultIn, shift.defaultOut)]); markDirty(); }}>＋</button></div>
        <div className="staff-labels"><span>In</span><span>Employee</span><span>AO</span><span>Out</span></div><div className="staff-rows">{rows.map((row) => { const employee = activeEmployees.find((item) => item.id === row.employeeId); return <div className={row.actingOfficer ? "staff-row ao-row" : "staff-row"} key={row.id}><select aria-label="Time in" value={row.timeIn} onChange={(event) => setStaffTimeIn(row.id, event.target.value)}>{timeOptions.map((time) => <option key={time.value} value={time.value}>{time.label}</option>)}</select><select aria-label="Employee name" value={row.employeeId} onChange={(event) => selectStaffEmployee(row.id, event.target.value)}><option value="">Select employee…</option>{activeEmployees.map((item) => <option key={item.id} value={item.id}>{displayName(item.name)}</option>)}</select><label className={row.actingOfficer ? "ao-check visible" : "ao-check"} title="Acting Officer"><input aria-label={`Acting Officer for ${employee ? displayName(employee.name) : "replacement"}`} type="checkbox" checked={row.actingOfficer} disabled /><span>AO</span></label><select aria-label="Time out" value={row.timeOut} onChange={(event) => setStaffTimeOut(row.id, event.target.value)}>{timeOptions.map((time) => <option key={time.value} value={time.value}>{time.label}</option>)}</select>{rows.length > 4 && <button className="remove-row" aria-label="Remove staffing row" onClick={() => { setStaffing((current) => current.filter((item) => item.id !== row.id)); markDirty(); }}>×</button>}</div>; })}</div>
        <div className="officer-actions"><button className={approval?.signInAt ? "approved" : ""} onClick={() => openHandoff(shift.key, shift.title, "in")}>{approval?.signInAt ? "✓ Officer Signed In" : "Officer Sign In"}</button><button className={approval?.signOutAt ? "approved" : ""} disabled={!approval?.signInAt} onClick={() => openHandoff(shift.key, shift.title, "out")}>{approval?.signOutAt ? "✓ Shift Approved" : "Officer Sign Out"}</button></div>
      </article>; })}</div>

      <article className="content-card calls-card"><div className="section-header"><div><h2>Calls & Responses</h2><p>Tap Now for the current time, then adjust it if needed.</p></div><button className="add-call" onClick={() => { setCalls((current) => [...current, blankCall()]); markDirty(); }}>＋ Add Call</button></div><datalist id="known-addresses">{addresses.map((address) => <option key={address} value={address} />)}</datalist><div className="call-list">{calls.map((call, index) => <div className="call-row" key={call.id}><div className="call-number">{index + 1}</div><label><span>Report #</span><input value={call.reportNumber} onChange={(event) => updateCall(call.id, { reportNumber: event.target.value })} /></label><label><span>Time out</span><div className="time-now"><input type="time" step="60" value={call.timeOut} onChange={(event) => updateCall(call.id, { timeOut: event.target.value })} /><button onClick={() => updateCall(call.id, { timeOut: nowTime() })}>Now</button></div></label><label><span>Time in</span><div className="time-now"><input type="time" step="60" value={call.timeIn} onChange={(event) => updateCall(call.id, { timeIn: event.target.value })} /><button onClick={() => updateCall(call.id, { timeIn: nowTime() })}>Now</button></div></label><label><span>Responding units</span><input placeholder="1203, 1205…" value={call.respondingUnits} onChange={(event) => updateCall(call.id, { respondingUnits: event.target.value })} /></label><label className="call-address"><span>Address</span><input list="known-addresses" autoComplete="street-address" placeholder="Start typing an address…" value={call.address} onChange={(event) => updateCall(call.id, { address: event.target.value })} /></label><label><span>Type</span><select value={call.callType} onChange={(event) => updateCall(call.id, { callType: event.target.value })}>{callTypes.map((type) => <option key={type}>{type}</option>)}</select></label>{calls.length > 1 && <button className="remove-call" aria-label={`Remove call ${index + 1}`} onClick={() => { setCalls((current) => current.filter((item) => item.id !== call.id)); markDirty(); }}>×</button>}</div>)}</div><button className="add-call bottom" onClick={() => { setCalls((current) => [...current, blankCall()]); markDirty(); }}>＋ Add Another Call</button></article>
      <article className="content-card notes-card"><label><span>Shift notes</span><textarea rows={5} placeholder="Equipment issues, coverage changes, station activity, follow-up items…" value={shiftNotes} onChange={(event) => { setShiftNotes(event.target.value); markDirty(); }} /></label></article>
    </fieldset>

    {handoff && <div className="handoff-backdrop" role="presentation"><section className="handoff-modal" role="dialog" aria-modal="true" aria-labelledby="handoff-title"><div className="handoff-header"><div><p className="eyebrow">{handoff.shiftTitle}</p><h2 id="handoff-title">Officer Sign {handoff.mode === "in" ? "In" : "Out"}</h2></div><button aria-label="Close officer approval" onClick={() => setHandoff(null)}>×</button></div>
      <label className="handoff-officer"><span>Officer completing approval</span><select value={officerId} onChange={(event) => setOfficerId(event.target.value)}><option value="">Select employee…</option>{activeEmployees.map((employee) => <option key={employee.id} value={employee.id}>{displayName(employee.name)}</option>)}</select></label>
      {handoff.mode === "in" && <section className="review-notes"><h3>Review previous 7 days of notes</h3><p>You must scroll through the notes before accepting the shift.</p><div className="notes-scroll" onScroll={(event) => { const el = event.currentTarget; if (el.scrollTop + el.clientHeight >= el.scrollHeight - 8) setReviewedNotes(true); }}>{recentNotes.length ? recentNotes.map((item, index) => <article key={`${item.logDate}-${index}`}><strong>{item.logDate}</strong><p>{item.note}</p></article>) : <article><strong>No prior notes</strong><p>There are no notes recorded in the previous seven days.</p></article>}<div className="scroll-end">End of seven-day notes</div></div><label className={reviewedNotes ? "accept-check ready" : "accept-check"}><input type="checkbox" disabled={!reviewedNotes} checked={acceptedNotes} onChange={(event) => setAcceptedNotes(event.target.checked)} /><span>I reviewed and accept the previous shift notes.</span></label></section>}
      <section className="equipment-check"><div><h3>Equipment accountability</h3><p>Confirm each item is present or document anything missing/out of service.</p></div>{equipmentItems.map((item) => <div className="equipment-row" key={item.key}><div><strong>{item.name}</strong><span>{item.detail}</span></div><select aria-label={`${item.name} status`} value={equipment[item.key].status} onChange={(event) => setEquipment((current) => ({ ...current, [item.key]: { ...current[item.key], status: event.target.value } }))}><option>Present</option><option>Missing</option><option>Out of Service</option></select>{equipment[item.key].status !== "Present" && <input aria-label={`${item.name} details`} placeholder="What is missing/OOS? Include unit…" value={equipment[item.key].detail} onChange={(event) => setEquipment((current) => ({ ...current, [item.key]: { ...current[item.key], detail: event.target.value } }))} />}</div>)}</section>
      <label className="handoff-note"><span>{handoff.mode === "in" ? "Officer notes" : "Closing shift note"}</span><textarea rows={3} placeholder={handoff.mode === "in" ? "Add coverage, equipment, or follow-up information…" : "Add the final handoff note for the next officer…"} value={handoffNote} onChange={(event) => setHandoffNote(event.target.value)} /></label>
      <div className="handoff-footer"><button className="quiet-button" onClick={() => setHandoff(null)}>Cancel</button><button className="primary-action compact" onClick={() => void submitHandoff()}>{handoff.mode === "in" ? "Accept Shift & Sign In" : "Approve Equipment & Sign Out"}</button></div>
    </section></div>}
  </section>;
}
