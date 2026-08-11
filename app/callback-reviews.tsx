"use client";

import { useCallback, useEffect, useState } from "react";
import { formatEmployeeName } from "./employee-names";
import { formatMilitaryTime } from "./military-time";

type Submission = {
  id: string;
  logDate: string;
  reportNumber: string;
  callType: string;
  callTimeOut: string;
  callTimeIn: string;
  status: string;
  submittedAt: string;
  reviewedAt?: string;
  reviewNote?: string;
  employeeName: string;
  employeeRank: string;
  reviewerName: string;
  submittedBy: string;
  submittedByRank: string;
  matches: string[];
  flags: string[];
  suggestedHours: number;
  approvedHours: number;
  actualMinutes: number | null;
};
type Reviewer = { id: string; name: string; rank: string };
type Payload = {
  submissions: Submission[];
  setting?: { reviewerEmployeeId: string; reviewerName: string; reviewerRank: string };
  reviewers: Reviewer[];
  error?: string;
};

const callbackRules = [
  ["Deputy Chief", "May submit callback attendance for any call; the assigned reviewer still approves it."],
  ["Weekend", "Calls from Friday 18:00 through Sunday 17:59 automatically qualify."],
  ["Holiday", "Any call on an approved department holiday automatically qualifies."],
  ["Call type", "Auto accident, fire alarm, mutual aid, and auto aid automatically qualify."],
  ["Back-to-back", "Calls dispatched within 5 minutes automatically qualify."],
  ["Hours", "2-hour minimum. Calls longer than 2 hours round up to the next quarter hour."],
  ["On shift", "A member already on duty is flagged for review; the submission is never automatically denied."],
  ["Overlap", "Another callback inside the same 2-hour window is flagged as possible double callback hours."],
] as const;

export default function CallbackReviews() {
  const [payload, setPayload] = useState<Payload>({ submissions: [], reviewers: [] });
  const [reviewerId, setReviewerId] = useState("");
  const [message, setMessage] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [hours, setHours] = useState<Record<string, number>>({});
  const load = useCallback(async () => {
    const response = await fetch("/api/callbacks?scope=review", { cache: "no-store" });
    const next = await response.json() as Partial<Payload>;
    const submissions = next.submissions ?? [];
    setPayload({ submissions, reviewers: next.reviewers ?? [], setting: next.setting, error: next.error });
    setReviewerId(next.setting?.reviewerEmployeeId ?? "");
    setHours((current) => Object.fromEntries(submissions.map((item) => [item.id, current[item.id] ?? item.suggestedHours])));
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  async function send(body: Record<string, unknown>) {
    setMessage("Saving...");
    const response = await fetch("/api/callbacks", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const result = await response.json() as { error?: string };
    setMessage(response.ok ? "Saved" : result.error ?? "Unable to save");
    if (response.ok) await load();
  }
  return <section className="callback-review-page">
    <div className="standard-page-header"><div><div><p className="eyebrow">Payroll review</p><h1>Callback Reviews</h1><p>Review callback attendance, rule flags, and payroll hours submitted from Daily Log calls.</p></div></div></div>
    {payload.error && <div className="board-alert">{payload.error}</div>}
    {message && <p className="callback-save-message" role="status">{message}</p>}

    <article className="content-card callback-reviewer-settings">
      <div className="section-header"><div><h2>Submission reviewer</h2><p>The selected officer receives new callback attendance submissions.</p></div></div>
      <div className="callback-reviewer-row"><label><span>Reviewer</span><select value={reviewerId} onChange={(event) => setReviewerId(event.target.value)}><option value="">Select reviewer…</option>{payload.reviewers.map((reviewer) => <option key={reviewer.id} value={reviewer.id}>{formatEmployeeName(reviewer.name)} · {reviewer.rank}</option>)}</select></label><button className="primary-action compact" disabled={!reviewerId} onClick={() => void send({ action: "setReviewer", reviewerEmployeeId: reviewerId })}>Save Reviewer</button></div>
    </article>

    <article className="content-card callback-rules-card">
      <div className="section-header"><div><h2>Callback approval rules</h2><p>Rules suggest hours and explain every flag. They never automatically deny a callback.</p></div><span className="callback-rule-version">Active</span></div>
      <div className="callback-rule-grid">{callbackRules.map(([name, detail]) => <div key={name}><strong>{name}</strong><span>{detail}</span></div>)}</div>
    </article>

    <article className="content-card">
      <div className="section-header"><div><h2>Submissions</h2><p>Pending and flagged submissions are shown first.</p></div><span className="count-badge">{payload.submissions.filter((item) => item.status === "pending").length} pending</span></div>
      {!payload.submissions.length && <div className="action-empty-state"><div><strong>No callback submissions yet</strong><p>Submitted attendance will appear here with its rule evaluation.</p></div></div>}
      <div className="callback-review-list">{payload.submissions.map((item) => {
        const approvedHours = hours[item.id] ?? item.suggestedHours;
        return <section className={`callback-review-item ${item.status} ${item.flags.length ? "flagged" : ""}`} key={item.id}>
          <header className="callback-review-heading">
            <div><strong>{formatEmployeeName(item.employeeName)}</strong><span>{item.employeeRank} · Call {item.reportNumber || "No report number"} · {item.logDate}</span><small>{item.callType || "Call type not entered"} · Out {formatMilitaryTime(item.callTimeOut) || "—"} · In {formatMilitaryTime(item.callTimeIn) || "—"}</small></div>
            <span className="callback-status">{item.status}</span>
          </header>
          <div className="callback-hour-summary"><div><span>Suggested callback</span><strong>{item.suggestedHours.toFixed(2)} hr</strong></div><div><span>Recorded duration</span><strong>{item.actualMinutes === null ? "Time In needed" : `${Math.floor(item.actualMinutes / 60)}h ${item.actualMinutes % 60}m`}</strong></div><div><span>Submitted by</span><strong>{item.submittedByRank || item.submittedBy || "Unknown"}</strong></div></div>
          {item.matches.length > 0 && <div className="callback-rule-results matches"><strong>Qualifying rules</strong><ul>{item.matches.map((match) => <li key={match}>{match}</li>)}</ul></div>}
          {item.flags.length > 0 && <div className="callback-rule-results flags" role="alert"><strong>Approval flags</strong><ul>{item.flags.map((flag) => <li key={flag}>{flag}</li>)}</ul><small>Flagged for human review — not automatically denied.</small></div>}
          {item.status === "pending" ? <div className="callback-review-form">
            <label><span>Approved hours</span><input type="number" min="0.25" max="24" step="0.25" value={approvedHours} onChange={(event) => setHours((current) => ({ ...current, [item.id]: Number(event.target.value) }))} /></label>
            <label className="callback-review-note"><span>Review note</span><input aria-label={`Review note for ${formatEmployeeName(item.employeeName)}`} placeholder="Optional review note" value={notes[item.id] ?? ""} onChange={(event) => setNotes((current) => ({ ...current, [item.id]: event.target.value }))} /></label>
            <div className="callback-review-actions"><button onClick={() => void send({ action: "review", id: item.id, status: "denied", reviewNote: notes[item.id] ?? "" })}>Deny</button><button className="primary-action compact" onClick={() => void send({ action: "review", id: item.id, status: "approved", approvedHours, reviewNote: notes[item.id] ?? "" })}>Approve &amp; Post Payroll</button></div>
          </div> : <div className="callback-reviewed-summary"><strong>{item.status === "approved" ? `${item.approvedHours.toFixed(2)} callback hours posted to payroll` : "Callback denied by reviewer"}</strong>{item.reviewNote && <span>{item.reviewNote}</span>}<small>Reviewer: {formatEmployeeName(item.reviewerName)}</small></div>}
        </section>;
      })}</div>
    </article>
  </section>;
}
