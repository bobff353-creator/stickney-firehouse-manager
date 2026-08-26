"use client";

import { useCallback, useEffect, useState } from "react";

type HealthState = "healthy" | "warning" | "unavailable";
type HealthCheck = { id: string; label: string; state: HealthState; value: string; detail: string; verifiedAt: string };
type HealthPayload = { summary: { state: "healthy" | "attention"; label: string; checkedAt: string }; checks: HealthCheck[] };

function checkedTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not checked" : date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

export default function SystemHealth() {
  const [payload, setPayload] = useState<HealthPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/system-health", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "System health could not be checked.");
      setPayload(result);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "System health could not be checked.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { const timer = window.setTimeout(() => void refresh(), 0); return () => window.clearTimeout(timer); }, [refresh]);

  return <section className="system-health-page">
    <div className="standard-page-header system-health-header">
      <div><span className="page-icon" aria-hidden="true">✓</span><div><p className="eyebrow">Administration</p><h1>System Health &amp; Backups</h1><p>Live service checks and honest backup-readiness evidence for command staff.</p></div></div>
      <button type="button" className="quiet-button" onClick={() => void refresh()} disabled={loading}>{loading ? "Checking…" : "Refresh status"}</button>
    </div>

    {error ? <div className="error-banner" role="alert"><span>{error}</span><button onClick={() => void refresh()}>Retry</button></div> : null}

    <article className={`system-health-summary ${payload?.summary.state ?? "loading"}`}>
      <span className="system-health-light" aria-hidden="true" />
      <div><p>System status</p><h2>{payload?.summary.label ?? "Checking system status…"}</h2><small>{payload ? `Verified ${checkedTime(payload.summary.checkedAt)}` : "Running live checks"}</small></div>
    </article>

    <div className="system-health-grid" aria-live="polite" aria-busy={loading}>
      {(payload?.checks ?? []).map((check) => <article className={`system-health-card ${check.state}`} key={check.id}>
        <header><span className="system-health-checkmark" aria-hidden="true">{check.state === "healthy" ? "✓" : check.state === "warning" ? "!" : "—"}</span><span className="system-health-state">{check.state === "healthy" ? "Verified" : check.state === "warning" ? "Needs attention" : "Not connected"}</span></header>
        <p>{check.label}</p><h3>{check.value}</h3><small>{check.detail}</small>
      </article>)}
      {loading && !payload ? Array.from({ length: 8 }, (_, index) => <article className="system-health-card loading" key={index}><span className="health-skeleton wide"/><span className="health-skeleton"/><span className="health-skeleton wide"/></article>) : null}
    </div>

    <article className="content-card system-health-trust-note">
      <div><p className="eyebrow">Evidence standard</p><h2>No green check without proof.</h2></div>
      <p>The page only marks a control verified when the portal receives a fresh response from the responsible system. Missing backup, usage, or security telemetry stays visible as not connected instead of showing an assumed success.</p>
    </article>
  </section>;
}
