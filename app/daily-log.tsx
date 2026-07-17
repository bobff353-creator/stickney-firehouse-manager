"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type LogEmployee = { id: string; name: string; startDate?: string | null; endDate?: string | null };
type StaffingRow = { id: string; shiftKey: string; employeeId: string; timeIn: string; timeOut: string };
type CallRow = { id: string; reportNumber: string; timeOut: string; timeIn: string; respondingUnits: string; address: string; callType: string };
type LogPayload = { log: { shiftNotes: string }; staffing: StaffingRow[]; calls: CallRow[]; addresses: string[]; error?: string };

const shiftSections = [
  { key: "morning", title: "6:00 AM – Noon", defaultIn: "06:00", defaultOut: "12:00" },
  { key: "afternoon", title: "Noon – 6:00 PM", defaultIn: "12:00", defaultOut: "18:00" },
  { key: "overnight", title: "6:00 PM – 6:00 AM", defaultIn: "18:00", defaultOut: "06:00" },
];
const callTypes = ["Fire", "EMS", "MVA", "TRT", "HazMat", "Auto Aid", "Mutual Aid", "Hazardous Condition", "Special"];
const timeOptions = Array.from({ length: 96 }, (_, index) => {
  const hours = Math.floor(index / 4);
  const minutes = (index % 4) * 15;
  const value = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  const displayHours = hours % 12 || 12;
  return { value, label: `${displayHours}:${String(minutes).padStart(2, "0")} ${hours < 12 ? "AM" : "PM"}` };
});

function localDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function nowTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function clientId() {
  return `row-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
function blankStaff(shiftKey: string, timeIn: string, timeOut: string): StaffingRow {
  return { id: clientId(), shiftKey, employeeId: "", timeIn, timeOut };
}
function blankCall(): CallRow {
  return { id: clientId(), reportNumber: "", timeOut: "", timeIn: "", respondingUnits: "", address: "", callType: "EMS" };
}
function displayName(value: string) {
  const [last, first] = value.split(",").map((part) => part.trim());
  return first ? `${first} ${last}` : value;
}

export default function DailyLog({ employees }: { employees: LogEmployee[] }) {
  const [logDate, setLogDate] = useState(localDate);
  const [staffing, setStaffing] = useState<StaffingRow[]>([]);
  const [calls, setCalls] = useState<CallRow[]>([]);
  const [shiftNotes, setShiftNotes] = useState("");
  const [addresses, setAddresses] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const loadLog = useCallback(async (date: string) => {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch(`/api/logbook?date=${date}`);
      const data = await response.json() as LogPayload;
      if (!response.ok) throw new Error(data.error || "Unable to load log");
      const rows = [...data.staffing];
      for (const shift of shiftSections) {
        const count = rows.filter((row) => row.shiftKey === shift.key).length;
        for (let i = count; i < 4; i += 1) rows.push(blankStaff(shift.key, shift.defaultIn, shift.defaultOut));
      }
      setStaffing(rows);
      setCalls(data.calls.length ? data.calls : Array.from({ length: 4 }, blankCall));
      setShiftNotes(data.log?.shiftNotes ?? "");
      setAddresses(data.addresses ?? []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load log");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadLog(logDate); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadLog, logDate]);
  const activeEmployees = useMemo(() => employees.filter((employee) => (!employee.startDate || employee.startDate <= logDate) && (!employee.endDate || employee.endDate >= logDate)), [employees, logDate]);

  function updateStaff(id: string, patch: Partial<StaffingRow>) {
    setStaffing((rows) => rows.map((row) => row.id === id ? { ...row, ...patch } : row));
  }
  function updateCall(id: string, patch: Partial<CallRow>) {
    setCalls((rows) => rows.map((row) => row.id === id ? { ...row, ...patch } : row));
  }
  async function saveLog() {
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/logbook", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ logDate, staffing: staffing.filter((row) => row.employeeId), calls: calls.filter((row) => Object.entries(row).some(([key, value]) => key !== "id" && value && value !== "EMS")), shiftNotes }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Unable to save log");
      setMessage("Daily log saved");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to save log"); }
    finally { setSaving(false); }
  }

  if (loading) return <section className="content-card log-loading">Loading daily log…</section>;
  return <section className="logbook-page">
    <div className="logbook-heading">
      <div><p className="eyebrow">Stickney Fire Department</p><h2>Daily Logbook</h2><p>Staffing, responses, and shift notes in one saved daily record.</p></div>
      <div className="log-date-actions"><label><span>Log date</span><input type="date" value={logDate} onChange={(event) => setLogDate(event.target.value)} /></label><button className="primary-action compact" disabled={saving} onClick={() => void saveLog()}>{saving ? "Saving…" : "Save Daily Log"}</button></div>
    </div>
    {message && <div className={message.includes("saved") ? "log-message success" : "log-message"}>{message}</div>}

    <div className="shift-card-grid">
      {shiftSections.map((shift) => {
        const rows = staffing.filter((row) => row.shiftKey === shift.key);
        return <article className="content-card shift-card" key={shift.key}>
          <div className="shift-title"><div><span>Staffing</span><h3>{shift.title}</h3></div><button aria-label={`Add person to ${shift.title}`} onClick={() => setStaffing((current) => [...current, blankStaff(shift.key, shift.defaultIn, shift.defaultOut)])}>＋</button></div>
          <div className="staff-labels"><span>In</span><span>Employee</span><span>Out</span></div>
          <div className="staff-rows">{rows.map((row) => <div className="staff-row" key={row.id}>
            <select aria-label="Time in" value={row.timeIn} onChange={(event) => updateStaff(row.id, { timeIn: event.target.value })}>{timeOptions.map((time) => <option key={time.value} value={time.value}>{time.label}</option>)}</select>
            <select aria-label="Employee name" value={row.employeeId} onChange={(event) => updateStaff(row.id, { employeeId: event.target.value })}><option value="">Select employee…</option>{activeEmployees.map((employee) => <option key={employee.id} value={employee.id}>{displayName(employee.name)}</option>)}</select>
            <select aria-label="Time out" value={row.timeOut} onChange={(event) => updateStaff(row.id, { timeOut: event.target.value })}>{timeOptions.map((time) => <option key={time.value} value={time.value}>{time.label}</option>)}</select>
            {rows.length > 4 && <button className="remove-row" aria-label="Remove staffing row" onClick={() => setStaffing((current) => current.filter((item) => item.id !== row.id))}>×</button>}
          </div>)}</div>
        </article>;
      })}
    </div>

    <article className="content-card calls-card">
      <div className="section-header"><div><h2>Calls & Responses</h2><p>Tap Now for the current time, then adjust it if needed.</p></div><button className="add-call" onClick={() => setCalls((current) => [...current, blankCall()])}>＋ Add Call</button></div>
      <datalist id="known-addresses">{addresses.map((address) => <option key={address} value={address} />)}</datalist>
      <div className="call-list">{calls.map((call, index) => <div className="call-row" key={call.id}>
        <div className="call-number">{index + 1}</div>
        <label><span>Report #</span><input value={call.reportNumber} onChange={(event) => updateCall(call.id, { reportNumber: event.target.value })} /></label>
        <label><span>Time out</span><div className="time-now"><input type="time" step="60" value={call.timeOut} onChange={(event) => updateCall(call.id, { timeOut: event.target.value })} /><button onClick={() => updateCall(call.id, { timeOut: nowTime() })}>Now</button></div></label>
        <label><span>Time in</span><div className="time-now"><input type="time" step="60" value={call.timeIn} onChange={(event) => updateCall(call.id, { timeIn: event.target.value })} /><button onClick={() => updateCall(call.id, { timeIn: nowTime() })}>Now</button></div></label>
        <label><span>Responding units</span><input placeholder="1203, 1205…" value={call.respondingUnits} onChange={(event) => updateCall(call.id, { respondingUnits: event.target.value })} /></label>
        <label className="call-address"><span>Address</span><input list="known-addresses" autoComplete="street-address" placeholder="Start typing an address…" value={call.address} onChange={(event) => updateCall(call.id, { address: event.target.value })} /></label>
        <label><span>Type</span><select value={call.callType} onChange={(event) => updateCall(call.id, { callType: event.target.value })}>{callTypes.map((type) => <option key={type}>{type}</option>)}</select></label>
        {calls.length > 1 && <button className="remove-call" aria-label={`Remove call ${index + 1}`} onClick={() => setCalls((current) => current.filter((item) => item.id !== call.id))}>×</button>}
      </div>)}</div>
      <button className="add-call bottom" onClick={() => setCalls((current) => [...current, blankCall()])}>＋ Add Another Call</button>
    </article>

    <article className="content-card notes-card"><label><span>Shift notes</span><textarea rows={5} placeholder="Equipment issues, coverage changes, station activity, follow-up items…" value={shiftNotes} onChange={(event) => setShiftNotes(event.target.value)} /></label></article>
    <div className="logbook-savebar"><span>Changes remain editable until you save.</span><button className="primary-action" disabled={saving} onClick={() => void saveLog()}>{saving ? "Saving…" : "Save Daily Log"}</button></div>
  </section>;
}
