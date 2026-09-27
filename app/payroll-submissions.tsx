"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { addPayDays, payDates, type SavedSubmission, type PayAdjustment, type SubmissionDocument } from "./payroll-submission";
import { payrollCsv, submittedExportRows } from "./payroll-submission-export";
import "./payroll-submissions.css";

export type SubmissionState = { submission: SavedSubmission | null; incoming: PayAdjustment[]; priorPeriods: string[] };
type Preview = { document: SubmissionDocument; blockers: string[]; fingerprint: string };
type Reconciliation = { candidates: PayAdjustment[]; blockers: string[] };
const money = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
const savedTime = (value: string) => new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
async function fetchSubmissionState(period: string, signal: AbortSignal) {
  const response = await fetch(`/api/payroll-submissions?period=${period}`, { cache: "no-store", signal });
  const data = await response.json(); if (!response.ok) throw new Error(data.error || "Unable to load submitted payroll.");
  return data as SubmissionState;
}
export function downloadPayrollRows(rows: Array<Array<string | number>>, filename: string) {
  const url = URL.createObjectURL(new Blob([payrollCsv(rows)], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename; anchor.click(); URL.revokeObjectURL(url);
}
export default function PayrollSubmissions({ period, end, disabled, finalized, onSaved }: { period: string; end: string; disabled: boolean; finalized: boolean; onSaved: (period: string, state: SubmissionState) => void }) {
  const [state, setState] = useState<SubmissionState | null>(null);
  const [staffingThrough, setStaffingThrough] = useState("");
  const [extrasThrough, setExtrasThrough] = useState("");
  const [sourcePeriod, setSourcePeriod] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [reconciliation, setReconciliation] = useState<Reconciliation | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const inFlight = useRef(false);
  const load = useCallback(async () => {
    const data = await fetchSubmissionState(period, AbortSignal.timeout(20000));
    setState(data); onSaved(period, data);
  }, [period, onSaved]);
  useEffect(() => {
    const controller = new AbortController();
    void fetchSubmissionState(period, AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]))
      .then(data => { if (!controller.signal.aborted) { setState(data); onSaved(period, data); } })
      .catch(e => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, [period, onSaved]);
  async function run(action: string, extra: Record<string, unknown> = {}) {
    if (inFlight.current || disabled) return;
    inFlight.current = true; setBusy(true); setError(""); setMessage("");
    try {
      if (action === "reload") { await load(); return; }
      const response = await fetch("/api/payroll-submissions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, period, staffingThrough, extrasThrough, sourcePeriod, ...extra }), signal: AbortSignal.timeout(25000) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "Payroll save was not confirmed.");
      if (action === "preview") { setPreview(data); setConfirmed(false); }
      if (action === "reconcile") setReconciliation(data);
      if (action === "submit" || action === "approve") {
        setMessage(data.alreadySaved ? "Already saved — no duplicate created." : action === "submit" ? "Submitted copy saved to server. Download it below and send it to the Village separately." : "Adjustment approved and saved once to this receiving period.");
        if (action === "submit") { setPreview(null); setConfirmed(false); }
        else setReconciliation(null);
        await load();
      }
    } catch (e) { setError(e instanceof Error && e.name === "TimeoutError" ? "Save not confirmed. Reload saved records before retrying. Repeating the same submission or approval cannot create a duplicate." : e instanceof Error ? e.message : "Save not confirmed. Reload and retry."); }
    finally { inFlight.current = false; setBusy(false); }
  }
  const document = state?.submission?.document ?? preview?.document;
  return <section className="payroll-submission-card" aria-labelledby="submission-title" aria-busy={busy}>
    <header><div><p className="eyebrow">Payroll delivery & corrections</p><h2 id="submission-title">Early submission & carry-forward</h2></div><button type="button" disabled={busy || disabled} onClick={() => void run("reload")}>Reload saved records</button></header>
    <p>Save a fixed copy for the Village, then keep recording actual work. This does not send payroll or mark wages paid. Ordinary timesheets below remain working records.</p>
    {disabled && <p role="status">Save or resolve pending timesheet edits before using this review.</p>}
    {error && <p className="submission-error" role="alert">{error}</p>}
    {message && <p className="submission-success" role="status">{message}</p>}
    {!state && !error && <p role="status">Loading saved submissions and approved adjustments…</p>}
    {state?.submission && <div className="submission-saved"><strong>Fixed submitted copy · {money(state.submission.document.grossCents)}</strong><p>Saved {savedTime(state.submission.createdAt)} Central by {state.submission.createdBy}. Later attendance changes do not change this copy.</p><button type="button" onClick={() => downloadPayrollRows(submittedExportRows(state.submission!.document), `Stickney-Submitted-Payroll-${period}.csv`)}>Download submitted copy</button></div>}
    {state && !state.submission && !finalized && <details><summary>1. Prepare and review a submitted copy</summary>
      <p>Choose the last <strong>fully recorded work date</strong> for staffing (06:00 through 06:00 next day). Remaining days use the saved department schedule, including overnight hours. If preparing at noon on the 24th, choosing the 23rd estimates the entire 24th and 25th. These are explicit estimates, not verified attendance.</p>
      <div className="submission-fields"><label>Staffing recorded through<select value={staffingThrough} disabled={busy} onChange={e => { setStaffingThrough(e.target.value); setPreview(null); setConfirmed(false); }}><option value="">Choose the last fully recorded work date</option><option value={addPayDays(period, -1)}>None — estimate this entire period</option>{payDates(period).map(d => <option key={d} value={d}>{d}{d === end ? " — all staffing recorded" : ""}</option>)}</select></label><label>Callbacks / work details through<select value={extrasThrough} disabled={busy} onChange={e => { setExtrasThrough(e.target.value); setPreview(null); setConfirmed(false); }}><option value="">Choose the last included work date</option><option value={addPayDays(period, -1)}>None — defer this period’s extras</option>{payDates(period).map(d => <option key={d} value={d}>{d}{d === end ? " — include through period end" : ""}</option>)}</select></label></div>
      <p>Only recorded callback and work-detail hours are included. Pending requests are not estimated. Recorded drills are included. No names, hours, or Acting Officer stipends are invented.</p>
      <button type="button" disabled={busy || disabled || !staffingThrough || !extrasThrough} onClick={() => void run("preview")}>{busy ? "Working…" : "Build preview — no payroll changes"}</button>
    </details>}
    {finalized && !state?.submission && <p>This legacy finalized period has no submitted snapshot. Its original Village submission cannot be guessed or rebuilt automatically.</p>}
    {preview && <><h3>Preview only · {money(preview.document.grossCents)}</h3>{preview.blockers.length > 0 && <div className="submission-error"><strong>Resolve before saving</strong><ul>{preview.blockers.map(b => <li key={b}>{b}</li>)}</ul></div>}
      <label className="submission-confirm"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} disabled={busy} />I reviewed the source detail, excluded records, rates and estimates. Save this exact copy for submission.</label><button type="button" disabled={!confirmed || busy || disabled || preview.blockers.length > 0} onClick={() => void run("submit", { fingerprint: preview.fingerprint, confirm: true })}>Save fixed submitted copy</button></>}
    {document && <details><summary>Hours, sources & frozen pay rules ({document.entries.length} rows)</summary>{document.warnings.map(w => <p key={w} className="submission-warning">{w}</p>)}<p>Original-period overtime threshold: {document.settings.overtimeThreshold} hours. DPW multiplier: {document.settings.dpwMultiplier}. These rules are frozen with the copy.</p><div className="submission-table"><table><thead><tr><th>Employee</th><th>Work date</th><th>Category</th><th>Hours</th><th>Source</th></tr></thead><tbody>{document.entries.map(e => <tr key={`${e.employeeId}-${e.workDate}-${e.category}`}><td>{document.employees.find(p => p.id === e.employeeId)?.name ?? e.employeeId}</td><td>{e.workDate}</td><td>{e.category}</td><td>{e.hours.toFixed(2)}</td><td>{e.basis === "schedule-estimate" ? "ESTIMATED · saved schedule" : "Recorded payroll"}<small>{e.sourceIds.join(", ")}</small></td></tr>)}</tbody></table></div><details><summary>Configured pay rates used</summary><ul>{document.employees.map(e => <li key={e.id}>{e.name}: regular {money(Math.round(e.regularRate * 100))}, overtime {money(Math.round(e.overtimeRate * 100))}, holiday {money(Math.round(e.holidayRate * 100))}</li>)}</ul></details></details>}
    {state && <details open={state.incoming.length > 0}><summary>2. Prior-period adjustments for this payroll ({state.incoming.length} approved)</summary><p>Original work dates and original-period pay rules are retained. Adjustments do not increase this period’s hours or count toward its overtime threshold.</p>
      {!!state.incoming.length && <><strong>Approved carry-forward total: {money(state.incoming.reduce((s, a) => s + a.deltaCents, 0))}</strong><ul>{state.incoming.map(a => <li key={a.id}>{a.employeeName}: {money(a.deltaCents)} from {a.sourcePeriod} · {a.note}</li>)}</ul></>}
      {!state.incoming.length && <p>No adjustments have been approved into this period.</p>}
      {!finalized && !state.submission && <><label>Original submitted period<select value={sourcePeriod} onChange={e => { setSourcePeriod(e.target.value); setReconciliation(null); }} disabled={busy}><option value="">Choose a submitted period</option>{state.priorPeriods.map(p => <option key={p} value={p}>{p}</option>)}</select></label><button type="button" disabled={!sourcePeriod || busy || disabled} onClick={() => void run("reconcile")}>Compare actuals with submitted payroll</button></>}
      {state.priorPeriods.length === 0 && <p>No earlier submitted copies exist yet. Previously sent payroll will not be reconstructed from today’s schedule.</p>}
      {reconciliation && <><div className="submission-warning">All three shift handoffs for each original-period day must be complete before approval. Missing hours are not treated as proof someone did not work.</div>{reconciliation.blockers.length > 0 && <details className="submission-error"><summary>{reconciliation.blockers.length} unresolved source checks</summary><ul>{reconciliation.blockers.map(b => <li key={b}>{b}</li>)}</ul></details>}{!reconciliation.candidates.length && <p>No new difference from the submitted copy and already approved adjustments.</p>}{reconciliation.candidates.map(a => <article className="adjustment-review" key={a.id}><h3>{a.employeeName} · {money(a.deltaCents)}</h3><p>Previously accounted for: {money(a.beforeCents)} → recorded actual total: {money(a.actualCents)}. Recalculated using the original period’s saved rates and overtime threshold.</p><ul>{a.changes.map(c => <li key={`${c.workDate}-${c.category}`}>{c.workDate} · {c.category}: {c.submittedHours} → {c.actualHours} hours</li>)}</ul><label>Approval reason / supporting record<input value={notes[a.id] ?? ""} maxLength={1500} onChange={e => setNotes(n => ({ ...n, [a.id]: e.target.value }))} disabled={busy} /></label><button type="button" disabled={busy || disabled || reconciliation.blockers.length > 0 || !notes[a.id]?.trim()} onClick={() => void run("approve", { candidateId: a.id, confirm: true, note: notes[a.id] })}>Approve {money(a.deltaCents)} into {period}</button></article>)}</>}
    </details>}
  </section>;
}
