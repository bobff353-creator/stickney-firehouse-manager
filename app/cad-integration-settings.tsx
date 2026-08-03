"use client";

import { useCallback, useEffect, useState } from "react";

type Receipt = {
  id: string;
  incidentId: string;
  eventType: string;
  payloadFormat: string;
  status: string;
  errorMessage: string;
  duplicateOf?: string | null;
  receivedAt: string;
  processedAt?: string | null;
};

type Status = {
  provider: string;
  stage: "prebuilt" | "credentials_configured";
  secretConfigured: boolean;
  webhookUrl: string;
  acceptedCount: number;
  failedCount: number;
  receipts: Receipt[];
  liveVerified: boolean;
  error?: string;
};

const samplePayload = JSON.stringify({
  incidentNumber: "TEST-ONLY-001",
  dispatchDateTime: "2026-07-28T19:45:00-05:00",
  nature: "Structure Fire",
  address: "100 Test Street",
  city: "Stickney",
  assignedUnits: ["1204", "1205"],
  status: "NEW",
}, null, 2);

function dateTime(value: string) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("en-US", { timeZone: "America/Chicago", dateStyle: "short", timeStyle: "short" });
}

export default function CadIntegrationSettings() {
  const [data, setData] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [sample, setSample] = useState(samplePayload);
  const [sampleResult, setSampleResult] = useState<Record<string, unknown> | null>(null);
  const [validating, setValidating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/cad/cis", { cache: "no-store" });
      const payload = await response.json() as Status;
      if (!response.ok) throw new Error(payload.error || "Unable to load the CAD integration.");
      setData(payload);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load the CAD integration.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function validateSample() {
    setValidating(true);
    setSampleResult(null);
    setError("");
    try {
      const response = await fetch("/api/cad/cis", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sample, contentType: "application/json" }),
      });
      const payload = await response.json() as Record<string, unknown>;
      setSampleResult(payload);
      if (!response.ok) throw new Error(String(payload.error || "The sample did not match the prepared CIS fields."));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to validate the sample.");
    } finally {
      setValidating(false);
    }
  }

  async function copyWebhook() {
    if (!data?.webhookUrl) return;
    await navigator.clipboard.writeText(data.webhookUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  const stage = data?.liveVerified ? "Live verified" : data?.secretConfigured ? "Credentials configured" : "Prebuilt";
  return (
    <section className="cad-settings-page">
      <div className="standard-page-header">
        <div><span className="page-icon">CAD</span><div><p className="eyebrow">Settings · Integrations</p><h1>CIS CAD Integration</h1><p>Prepared for Computer Information Systems CAD used by Cicero Consolidated Dispatch.</p></div></div>
        <button className="quiet-button" onClick={() => void load()} disabled={loading}>{loading ? "Refreshing…" : "Refresh status"}</button>
      </div>

      {error && <div className="error-banner" role="alert"><span>{error}</span><button onClick={() => setError("")}>Dismiss</button></div>}

      <section className="cad-status-grid">
        <article className="content-card cad-readiness-card">
          <header><div><span className={`cad-stage ${data?.liveVerified ? "live" : data?.secretConfigured ? "configured" : "prebuilt"}`}>{stage}</span><h2>Connection readiness</h2></div><span className="cad-provider-mark">CIS</span></header>
          <div className="cad-checklist">
            <div className="complete"><b>1</b><span><strong>Secure receiver and parser</strong><small>Built for JSON, form, XML, or labeled text messages.</small></span></div>
            <div className="complete"><b>2</b><span><strong>Call board and Daily Log connection</strong><small>New and updated calls use the same operational records already shown on the board.</small></span></div>
            <div className={data?.secretConfigured ? "complete" : "waiting"}><b>3</b><span><strong>Webhook secret</strong><small>{data?.secretConfigured ? "CIS_CAD_WEBHOOK_SECRET is configured." : "Add CIS_CAD_WEBHOOK_SECRET to the hosted site before accepting deliveries."}</small></span></div>
            <div className="waiting"><b>4</b><span><strong>CIS / dispatch message mapping</strong><small>Waiting for a sanitized sample of new, updated, and cleared incidents plus their delivery rules.</small></span></div>
            <div className="waiting"><b>5</b><span><strong>End-to-end live verification</strong><small>A real test must be received, stored, displayed on the Operations Board, updated, and cleared before this becomes Live verified.</small></span></div>
          </div>
        </article>

        <article className="content-card cad-endpoint-card">
          <header><div><p className="eyebrow">Prepared receiver</p><h2>Webhook address</h2></div></header>
          <div className="cad-url"><code>{data?.webhookUrl || "Loading…"}</code><button onClick={() => void copyWebhook()} disabled={!data?.webhookUrl}>{copied ? "Copied" : "Copy"}</button></div>
          <p>This address is prebuilt, but it must not be given to CIS as a production destination until their approved authentication method and the site’s public network path are confirmed.</p>
          <dl>
            <div><dt>Authentication</dt><dd>Bearer secret or HMAC-SHA256 adapter</dd></div>
            <div><dt>Maximum message</dt><dd>256 KB</dd></div>
            <div><dt>Duplicate protection</dt><dd>SHA-256 receipt fingerprint</dd></div>
            <div><dt>Raw message retention</dt><dd>Stored for audit and mapping repair</dd></div>
          </dl>
        </article>
      </section>

      <section className="content-card cad-sample-card">
        <div className="section-header"><div><h2>Validate a sanitized CIS sample</h2><p>This checks field mapping only. It does not create an active call or contact the dispatch network.</p></div><button className="primary-action compact" onClick={() => void validateSample()} disabled={validating}>{validating ? "Checking…" : "Validate sample"}</button></div>
        <textarea aria-label="Sanitized CIS sample payload" value={sample} onChange={(event) => setSample(event.target.value)} rows={12} spellCheck={false} />
        {sampleResult && <div className={`cad-sample-result ${sampleResult.ok ? "valid" : "invalid"}`}><strong>{sampleResult.ok ? "Sample mapped successfully" : "Sample needs mapping"}</strong><pre>{JSON.stringify(sampleResult, null, 2)}</pre></div>}
      </section>

      <section className="content-card cad-receipts-card">
        <div className="section-header"><div><h2>Recent CIS deliveries</h2><p>Only receipt status is shown here; raw call messages stay protected.</p></div><div className="cad-counts"><span>{data?.acceptedCount ?? 0} accepted</span><span>{data?.failedCount ?? 0} rejected</span></div></div>
        {!data?.receipts.length ? <div className="action-empty-state"><span>↯</span><div><strong>No CIS deliveries received</strong><p>This is expected until CIS/Cicero Dispatch completes the connection.</p></div></div> :
          <div className="table-wrap"><table><thead><tr><th>Received</th><th>Incident</th><th>Event</th><th>Format</th><th>Result</th></tr></thead><tbody>{data.receipts.map((receipt) => <tr key={receipt.id}><td>{dateTime(receipt.receivedAt)}</td><td>{receipt.incidentId || "Not mapped"}</td><td>{receipt.eventType || "—"}</td><td>{receipt.payloadFormat || "—"}</td><td><span className={`cad-receipt-status ${receipt.status}`}>{receipt.status}</span>{receipt.errorMessage && <small>{receipt.errorMessage}</small>}</td></tr>)}</tbody></table></div>}
      </section>

      <section className="content-card cad-needed-card">
        <div className="section-header"><div><h2>Information needed from CIS / Cicero Dispatch</h2><p>The photos confirm the VPN and MCS environment, but they do not define the CAD message contract.</p></div></div>
        <ul><li>Approved integration method: webhook, vendor API, MCS interface, secure file, or another supported feed</li><li>Sanitized examples for a new call, call update, unit update, and cleared call</li><li>Stable incident and event identifiers, timestamps, retry behavior, and acknowledgment requirements</li><li>Network allowlist, test environment, and a CIS or Cicero Dispatch technical contact</li></ul>
        <p className="cad-security-note"><strong>Security:</strong> Do not upload or paste VPN, workstation, Wi-Fi, or CAD passwords here. Those credentials are not needed for message mapping.</p>
      </section>
    </section>
  );
}
