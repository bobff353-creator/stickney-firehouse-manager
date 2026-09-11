"use client";
import { useId, useState } from "react";

export type Revision = { revisionNumber: number; action: string; summary: string; actor: string; changedAt: string };
export type RecordAudit = { recordNumber: string; status: string; createdBy?: string; createdAt?: string; updatedBy?: string; updatedAt?: string; closedBy?: string; closedAt?: string; closedLabel?: string; revisions?: Revision[] };

const when = (value?: string) => value ? new Date(value.endsWith("Z") ? value : `${value}Z`).toLocaleString() : "—";

export function RecordCredibility({ audit }: { audit: RecordAudit }) {
  const [expanded, setExpanded] = useState(false);
  const detailsId = useId();
  return <aside className="record-credibility" aria-label="Official record details" data-test-safe>
    <div className="record-identity"><div><span>Record number</span><strong>{audit.recordNumber}</strong></div><span className={`record-status ${audit.status.toLowerCase()}`}>{audit.status}</span><button type="button" className="record-print" onClick={() => window.print()}>Print / Save PDF</button></div>
    <button type="button" className="record-details-toggle" aria-expanded={expanded} aria-controls={detailsId} onClick={() => setExpanded(value => !value)}>{expanded ? "Hide record details & history" : "Record details & history"} <span aria-hidden="true">{expanded ? "−" : "+"}</span></button>
    <div className="record-details-body" id={detailsId} hidden={!expanded}>
    <div className="record-metadata">
      <div><span>Created</span><strong>{audit.createdBy || "System"}</strong><small>{when(audit.createdAt)}</small></div>
      <div><span>Last updated</span><strong>{audit.updatedBy || "System"}</strong><small>{when(audit.updatedAt)}</small></div>
      <div><span>{audit.closedLabel || "Finalized"}</span><strong>{audit.closedBy || "Not finalized"}</strong><small>{when(audit.closedAt)}</small></div>
    </div>
    <details className="revision-history"><summary>Revision history <span>{audit.revisions?.length || 0}</span></summary>{audit.revisions?.length ? <ol>{audit.revisions.map((revision) => <li key={revision.revisionNumber}><strong>Revision {revision.revisionNumber} · {revision.action}</strong><span>{revision.summary}</span><small>{revision.actor} · {when(revision.changedAt)}</small></li>)}</ol> : <p>No revisions have been recorded yet.</p>}</details>
    </div>
  </aside>;
}
