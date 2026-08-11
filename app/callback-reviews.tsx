"use client";

import { useCallback, useEffect, useState } from "react";
import { formatEmployeeName } from "./employee-names";

type Submission = { id: string; logDate: string; reportNumber: string; status: string; submittedAt: string; reviewedAt?: string; reviewNote?: string; employeeName: string; employeeRank: string; reviewerName: string };
type Reviewer = { id: string; name: string; rank: string };
type Payload = { submissions: Submission[]; setting?: { reviewerEmployeeId: string; reviewerName: string; reviewerRank: string }; reviewers: Reviewer[]; error?: string };

export default function CallbackReviews() {
  const [payload, setPayload] = useState<Payload>({ submissions: [], reviewers: [] });
  const [reviewerId, setReviewerId] = useState("");
  const [message, setMessage] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const load = useCallback(async () => {
    const response = await fetch("/api/callbacks?scope=review", { cache: "no-store" });
    const next = await response.json() as Partial<Payload>;
    setPayload({
      submissions: next.submissions ?? [],
      reviewers: next.reviewers ?? [],
      setting: next.setting,
      error: next.error,
    });
    setReviewerId(next.setting?.reviewerEmployeeId ?? "");
  }, []);
  useEffect(() => { void load(); }, [load]);
  async function send(body: Record<string, unknown>) {
    setMessage("Saving...");
    const response = await fetch("/api/callbacks", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const result = await response.json() as { error?: string };
    setMessage(response.ok ? "Saved" : result.error ?? "Unable to save");
    if (response.ok) await load();
  }
  return <section className="callback-review-page">
    <div className="standard-page-header"><div><div><p className="eyebrow">Payroll review</p><h1>Callback Reviews</h1><p>Review callback attendance submitted from generated Daily Log calls.</p></div></div></div>
    {payload.error && <div className="board-alert">{payload.error}</div>}
    {message && <p className="callback-save-message" role="status">{message}</p>}
    <article className="content-card callback-reviewer-settings"><div className="section-header"><div><h2>Submission reviewer</h2><p>The selected officer receives new callback attendance submissions.</p></div></div><div className="callback-reviewer-row"><label><span>Reviewer</span><select value={reviewerId} onChange={(event) => setReviewerId(event.target.value)}><option value="">Select reviewer…</option>{payload.reviewers.map((reviewer) => <option key={reviewer.id} value={reviewer.id}>{formatEmployeeName(reviewer.name)} · {reviewer.rank}</option>)}</select></label><button className="primary-action compact" disabled={!reviewerId} onClick={() => void send({ action: "setReviewer", reviewerEmployeeId: reviewerId })}>Save Reviewer</button></div><p className="helper-note">Attendance review only. Payroll callback hours, minimums, and other rules will be added in this area later.</p></article>
    <article className="content-card"><div className="section-header"><div><h2>Submissions</h2><p>Pending submissions are shown first.</p></div><span className="count-badge">{payload.submissions.filter((item) => item.status === "pending").length} pending</span></div>
      {!payload.submissions.length && <div className="action-empty-state"><div><strong>No callback submissions yet</strong><p>Submitted attendance will appear here for review.</p></div></div>}
      <div className="callback-review-list">{payload.submissions.map((item) => <section className={`callback-review-item ${item.status}`} key={item.id}><div><strong>{formatEmployeeName(item.employeeName)}</strong><span>{item.employeeRank} · Call {item.reportNumber || "No report number"} · {item.logDate}</span><small>Reviewer: {formatEmployeeName(item.reviewerName)}</small></div><span className="callback-status">{item.status}</span>{item.status === "pending" && <><input aria-label={`Review note for ${formatEmployeeName(item.employeeName)}`} placeholder="Optional review note" value={notes[item.id] ?? ""} onChange={(event) => setNotes((current) => ({ ...current, [item.id]: event.target.value }))} /><div className="callback-review-actions"><button onClick={() => void send({ action: "review", id: item.id, status: "denied", reviewNote: notes[item.id] ?? "" })}>Deny</button><button className="primary-action compact" onClick={() => void send({ action: "review", id: item.id, status: "approved", reviewNote: notes[item.id] ?? "" })}>Approve</button></div></>}</section>)}</div>
    </article>
  </section>;
}
