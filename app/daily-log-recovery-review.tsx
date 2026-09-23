"use client";
import { useMemo, useRef, useEffect, useState } from "react";
import { formatEmployeeName } from "./employee-names";
import { readLogNotes } from "./daily-log-workflow";
import { logDifferences, resolveLogDifferences, type LogSnapshot, type LogDifference, type RecoveryChoice } from "./daily-log-recovery";

const fieldNames: Record<string, string> = { shiftKey: "Shift", employeeId: "Employee", timeIn: "Time in", timeOut: "Time out", actingOfficer: "Acting Officer", reportNumber: "Report number", respondingUnits: "Responding units", address: "Address", callType: "Call type", shiftNotes: "Notes & Handoff", row: "Entry" };
const shiftNames: Record<string, string> = { morning: "6 AM–Noon", afternoon: "Noon–6 PM", overnight: "6 PM–6 AM" };

export default function DailyLogRecoveryReview({ draft, saved, employees, locked, canUnlock, onUnlock, onApply, onBack }: {
  draft: LogSnapshot; saved: LogSnapshot; employees: { id: string; name: string }[];
  locked: boolean; canUnlock: boolean; onUnlock: () => void;
  onApply: (result: LogSnapshot) => Promise<void>; onBack: () => void;
}) {
  const differences = useMemo(() => logDifferences(draft, saved), [draft, saved]);
  const [choices, setChoices] = useState<Record<string, RecoveryChoice>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus({ preventScroll: true }); heading.current?.scrollIntoView({ block: "start" }); }, []);
  const name = (id: string) => { const employee = employees.find(item => item.id === id); return employee ? formatEmployeeName(employee.name) : `Employee ${id}`; };
  const remaining = differences.filter(item => !choices[item.key]).length;
  function label(item: LogDifference) {
    if (item.section === "shiftNotes") return "Notes & Handoff";
    if (item.section === "staffing") {
      const row = draft.staffing.find(row => row.id === item.id) || saved.staffing.find(row => row.id === item.id)!;
      return `${name(row.employeeId)} · ${shiftNames[row.shiftKey] || row.shiftKey} · ${fieldNames[item.field]}`;
    }
    const row = draft.calls.find(row => row.id === item.id) || saved.calls.find(row => row.id === item.id)!;
    return `Call ${row.reportNumber || "without report number"}${row.address ? ` · ${row.address}` : ""} · ${fieldNames[item.field]}`;
  }
  function display(item: LogDifference, side: RecoveryChoice) {
    const value = item[side];
    if (value === undefined) return "Entry not in this copy — choosing this removes it from the final log.";
    if (typeof value === "boolean") return value ? "Yes" : "No";
    if (typeof value === "object") {
      if ("employeeId" in value) return `${name(value.employeeId)}\n${shiftNames[value.shiftKey] || value.shiftKey}\nIn: ${value.timeIn || "Not entered"} · Out: ${value.timeOut || "Not entered"}\nActing Officer: ${value.actingOfficer ? "Yes" : "No"}`;
      return `Report: ${value.reportNumber || "Not entered"}\n${value.callType} · ${value.address || "No address"}\nOut: ${value.timeOut || "Not entered"} · In: ${value.timeIn || "Not entered"}\nUnits: ${value.respondingUnits || "Not entered"}`;
    }
    if (item.field === "employeeId") return name(value);
    if (item.field === "shiftKey") return shiftNames[value] || value;
    if (item.field === "shiftNotes") {
      const notes = readLogNotes(value);
      return [notes.text, ...notes.entries.map(entry => `${entry.category} · ${entry.status}\n${entry.text}`)].filter(Boolean).join("\n\n") || "No notes";
    }
    return value || "Not entered";
  }
  return <section className="log-recovery-review no-print" aria-labelledby="log-recovery-title">
    <h2 id="log-recovery-title" tabIndex={-1} ref={heading}>Review changes</h2>
    <p>{differences.length ? "Choose which version to keep for each difference. Matching information stays unchanged. Nothing is saved until you finish." : "Your draft already matches the saved log. You can continue without saving it again."}</p>
    {locked && <div className="log-attention"><p>This log is locked. An administrator must unlock it before saving corrections. Your draft stays here.</p>{canUnlock && <button type="button" disabled={busy} onClick={onUnlock}>Admin Unlock</button>}</div>}
    {differences.some(item => item.section === "shiftNotes") && <p>For Notes &amp; Handoff, choose the complete set of notes to keep.</p>}
    {differences.map((item, index) => <fieldset key={item.key} className="log-recovery-difference" disabled={busy}>
      <legend>{index + 1}. {label(item)}</legend>
      <div className="log-recovery-options">{(["draft", "saved"] as const).map(side => <label key={side} className={choices[item.key] === side ? "selected" : ""}>
        <span><input type="radio" name={`recovery-${index}`} value={side} checked={choices[item.key] === side} onChange={() => setChoices(current => ({ ...current, [item.key]: side }))} />{side === "draft" ? "Keep my draft" : "Use saved version"}</span>
        <span className="log-recovery-value">{display(item, side)}</span>
      </label>)}</div>
    </fieldset>)}
    {error && <p role="alert" className="log-attention">{error}</p>}
    <div className="log-recovery-actions">
      <span role="status">{remaining ? `${remaining} ${remaining === 1 ? "choice" : "choices"} remaining` : differences.length ? "Ready to save your selections" : "No differences"}</span>
      <button type="button" disabled={busy} onClick={onBack}>Back · keep draft</button>
      <button type="button" className="recovery-primary" disabled={busy || remaining > 0 || (locked && differences.length > 0)} onClick={async () => {
        if (pending.current) return;
        pending.current = true; setBusy(true); setError("");
        try { await onApply(resolveLogDifferences(draft, saved, choices)); }
        catch (error) { setError(error instanceof Error ? error.message : "Unable to finish. Your draft is still here."); }
        finally { pending.current = false; setBusy(false); }
      }}>{busy ? "Saving…" : differences.length ? "Save selected changes" : "Continue editing"}</button>
    </div>
  </section>;
}
