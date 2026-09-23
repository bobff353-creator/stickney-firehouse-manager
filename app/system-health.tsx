"use client";

import { useCallback, useEffect, useState } from "react";
import type { HealthPayload } from "./system-health-model";
import DepartmentHandoff from "./department-handoff";

function checkedTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not checked" : date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

export default function SystemHealth({ permissions = [] }: { permissions?: readonly string[] }) {
  const [payload, setPayload] = useState<HealthPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [section, setSection] = useState<"status" | "handoff">("status");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/system-health", { cache: "no-store", signal: AbortSignal.timeout(10000) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "System health could not be checked.");
      setPayload(result);
    } catch (problem) {
      setPayload(null); // Do not leave old green cards visible after a failed live check.
      setError(problem instanceof Error ? problem.message : "System health could not be checked.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { const timer = window.setTimeout(() => void refresh(), 0); return () => window.clearTimeout(timer); }, [refresh]);

  return <section className="system-health-page">
    <div className="standard-page-header system-health-header">
      <div><span className="page-icon" aria-hidden="true">✓</span><div><p className="eyebrow">Administration</p><h1>System Health &amp; Backups</h1><p>Check current status, then review what the department needs for handoff and support.</p></div></div>
      <button type="button" className="quiet-button" onClick={() => void refresh()} disabled={loading}>{loading ? "Checking…" : "Refresh status"}</button>
    </div>

    <nav className="health-section-nav" aria-label="System health sections">
      <button type="button" className="quiet-button" aria-current={section === "status" ? "page" : undefined} onClick={() => setSection("status")}>Status &amp; backups</button>
      <button type="button" className="quiet-button" aria-current={section === "handoff" ? "page" : undefined} onClick={() => setSection("handoff")}>Department handoff &amp; support</button>
    </nav>

    {error ? <div className="error-banner" role="alert"><span>{error}</span><button onClick={() => void refresh()}>Retry</button></div> : null}

    <article className={`system-health-summary ${payload?.summary.state ?? "loading"}`}>
      <span className="system-health-light" aria-hidden="true" />
      <div><p>System status</p><h2>{payload?.summary.label ?? (error ? "System status could not be verified" : "Checking system status…")}</h2><small>{payload ? `Checked ${checkedTime(payload.summary.checkedAt)}` : error ? "No current results available" : "Running live checks"}</small></div>
    </article>

    {section === "handoff" ? <DepartmentHandoff payload={payload} permissions={permissions} /> : <>
    <div className="system-health-grid" aria-live="polite" aria-busy={loading}>
      {(payload?.checks ?? []).map((check) => <article className={`system-health-card ${check.state}`} key={check.id}>
        <header><span className="system-health-checkmark" aria-hidden="true">{check.state === "healthy" ? "✓" : check.state === "warning" ? "!" : "—"}</span><span className="system-health-state">{check.statusLabel ?? (check.state === "healthy" ? "Verified" : check.state === "warning" ? "Needs attention" : "Not connected")}</span></header>
        <p>{check.label}</p><h3>{check.value}</h3><small>{check.detail}</small>
        {check.verifiedAt ? <small>Checked {checkedTime(check.verifiedAt)}</small> : null}
        {check.action ? <a className="quiet-button" href={check.action.href} target="_blank" rel="noopener noreferrer">{check.action.label} ↗</a> : null}
      </article>)}
      {loading && !payload ? Array.from({ length: 8 }, (_, index) => <article className="system-health-card loading" key={index}><span className="health-skeleton wide"/><span className="health-skeleton"/><span className="health-skeleton wide"/></article>) : null}
    </div>

    <article className="content-card system-health-trust-note">
      <div><p className="eyebrow">Evidence standard</p><h2>No green check without proof.</h2></div>
      <p>Each card describes exactly what was checked. File metadata is not a file-open test; a completed backup is not a restore test. Missing recovery checks keep the overall status at Needs attention. See Department handoff &amp; support for the next steps.</p>
    </article>
    </>}
  </section>;
}
