"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatEmployeeName } from "./employee-names";
import { workedHours } from "./payroll-hours";

type Person = { id: string; name: string; rank: string; isAdmin?: number };
type Detail = { id: string; workDate: string; requestingOfficerName: string; approverId: string; approverName: string; startTime: string; endTime: string; totalHours: number; workType: string; description: string; status: string; rejectionNote?: string; members: Person[] };
type Data = { viewer: { employeeId: string | null; isAdmin: boolean }; employees: Person[]; officers: Person[]; approvers: Person[]; requests: Detail[] };
const localToday = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
const initialForm = () => ({ workDate: localToday(), requestingOfficerId: "", approverId: "", startTime: "08:00", endTime: "09:00", workType: "", description: "", certified: false });

export default function WorkDetails() {
  const [data, setData] = useState<Data | null>(null);
  const [form, setForm] = useState(initialForm);
  const [selected, setSelected] = useState<string[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const load = useCallback(async () => {
    const response = await fetch("/api/work-details");
    const payload = await response.json() as Data & { error?: string };
    if (!response.ok) throw new Error(payload.error || "Unable to load work details");
    setData(payload);
    setForm((current) => ({ ...current, requestingOfficerId: current.requestingOfficerId || payload.officers[0]?.id || "", approverId: current.approverId || payload.approvers[0]?.id || "" }));
  }, []);
  useEffect(() => { void load().catch((caught) => setError(caught instanceof Error ? caught.message : "Unable to load work details")); }, [load]);
  const hours = workedHours(form.startTime, form.endTime);
  const filtered = useMemo(() => (data?.employees ?? []).filter((person) => `${person.name} ${person.rank}`.toLowerCase().includes(search.toLowerCase())), [data, search]);
  const selectedNames = (data?.employees ?? []).filter((person) => selected.includes(person.id)).map((person) => formatEmployeeName(person.name));
  async function post(payload: Record<string, unknown>) { const response = await fetch("/api/work-details", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) }); const result = await response.json() as { error?: string }; if (!response.ok) throw new Error(result.error || "Unable to save work detail"); }
  async function submit(event: React.FormEvent) { event.preventDefault(); setBusy(true); setError(""); try { await post({ action: "submit", ...form, employeeIds: selected }); setForm({ ...initialForm(), requestingOfficerId: data?.officers[0]?.id || "", approverId: data?.approvers[0]?.id || "" }); setSelected([]); setMessage("Work detail submitted for approval"); await load(); } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to submit work detail"); } finally { setBusy(false); } }
  async function review(id: string, action: "approve" | "reject") { let note = ""; if (action === "reject") { note = window.prompt("Reason for rejection")?.trim() ?? ""; if (!note) return; } setBusy(true); setError(""); try { await post({ action, id, note }); setMessage(action === "approve" ? "Approved hours were added to payroll" : "Work detail rejected"); await load(); } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to review work detail"); } finally { setBusy(false); } }
  return <div className="work-detail-page">
    <section className="content-card work-detail-form-card"><div className="section-header"><div><p className="eyebrow">Payroll workflow</p><h2>New Work Detail Sheet</h2><p>Hours enter employee timesheets only after approval.</p></div><span className="count-badge">{data?.requests.filter((item) => item.status === "pending").length ?? 0} pending</span></div>
      {error && <div className="error-banner" role="alert">{error}</div>}{message && <div className="work-detail-message" role="status">{message}</div>}
      <form onSubmit={submit} className="work-detail-form"><fieldset><legend>Assignment</legend><div className="work-detail-fields">
        <label className="member-picker-field"><span>Employees on detail *</span><button type="button" className="member-picker-trigger" onClick={() => setPickerOpen((current) => !current)}>{selectedNames.length ? `${selectedNames.length} selected: ${selectedNames.join(", ")}` : "Select one or more employees"}<b>⌄</b></button>{pickerOpen && <div className="member-picker"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search roster…" /><div>{filtered.map((person) => <label key={person.id}><input type="checkbox" checked={selected.includes(person.id)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, person.id] : current.filter((id) => id !== person.id))}/><span><strong>{formatEmployeeName(person.name)}</strong><small>{person.rank}</small></span></label>)}</div><button type="button" onClick={() => setPickerOpen(false)}>Done · {selected.length} selected</button></div>}</label>
        <label><span>Date *</span><input type="date" required value={form.workDate} onChange={(event) => setForm({ ...form, workDate: event.target.value })}/></label>
        <label><span>Requesting officer *</span><select required value={form.requestingOfficerId} onChange={(event) => setForm({ ...form, requestingOfficerId: event.target.value })}><option value="">Select officer</option>{data?.officers.map((person) => <option key={person.id} value={person.id}>{formatEmployeeName(person.name)} - {person.rank}</option>)}</select></label>
        <label><span>Send for approval to *</span><select required value={form.approverId} onChange={(event) => setForm({ ...form, approverId: event.target.value })}><option value="">Select approver</option>{data?.approvers.map((person) => <option key={person.id} value={person.id}>{formatEmployeeName(person.name)} - {person.rank}</option>)}</select></label>
        <label><span>Start time *</span><input type="time" required value={form.startTime} onChange={(event) => setForm({ ...form, startTime: event.target.value })}/></label>
        <label><span>End time *</span><input type="time" required value={form.endTime} onChange={(event) => setForm({ ...form, endTime: event.target.value })}/></label>
        <label className="total-time"><span>Total time</span><output>{hours.toFixed(2)} hours</output></label>
        <label><span>Type of work *</span><select required value={form.workType} onChange={(event) => setForm({ ...form, workType: event.target.value })}><option value="">Select work type</option><option>Station maintenance</option><option>Apparatus maintenance</option><option>Training support</option><option>Public education</option><option>Inspection support</option><option>Administrative assignment</option><option>Special event</option><option>Other</option></select></label>
        <label className="work-description"><span>Description of work *</span><textarea required rows={4} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Describe the assignment and work completed."/></label>
      </div></fieldset><label className="certification-check"><input type="checkbox" checked={form.certified} onChange={(event) => setForm({ ...form, certified: event.target.checked })}/><span><strong>I approve the information entered above.</strong><small>I certify the selected members, date, times, and work description are accurate.</small></span></label><button className="primary-action" disabled={busy || !form.certified || selected.length === 0 || hours <= 0}>{busy ? "Saving…" : "Submit for Approval"}</button></form>
    </section>
    <section className="content-card work-detail-queue"><div className="section-header"><div><h2>Work Detail Approval Queue</h2><p>Pending requests appear first. Approved hours are posted automatically.</p></div></div>{!data?.requests.length ? <div className="action-empty-state"><span>✓</span><div><strong>No work detail sheets</strong><p>Create the first sheet using the form above.</p></div></div> : <div className="work-detail-list">{data.requests.map((detail) => { const canApprove = detail.status === "pending" && (data.viewer.isAdmin || data.viewer.employeeId === detail.approverId); return <article key={detail.id} className={detail.status}><header><div><span>{detail.workDate}</span><strong>{detail.workType}</strong></div><b>{detail.status}</b></header><p>{detail.description}</p><dl><div><dt>Members</dt><dd>{detail.members.map((person) => formatEmployeeName(person.name)).join(", ")}</dd></div><div><dt>Time</dt><dd>{detail.startTime}–{detail.endTime} · {detail.totalHours.toFixed(2)} hours each</dd></div><div><dt>Requesting officer</dt><dd>{formatEmployeeName(detail.requestingOfficerName)}</dd></div><div><dt>Approver</dt><dd>{formatEmployeeName(detail.approverName)}</dd></div></dl>{detail.rejectionNote && <small className="rejection-note">Rejected: {detail.rejectionNote}</small>}{canApprove && <footer><button disabled={busy} onClick={() => void review(detail.id, "reject")}>Reject</button><button disabled={busy} onClick={() => void review(detail.id, "approve")}>Approve & Add Hours</button></footer>}</article>; })}</div>}</section>
  </div>;
}
