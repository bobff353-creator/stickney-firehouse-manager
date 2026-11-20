"use client";
import { departmentTimestamp } from "./department-time";

import { useCallback, useEffect, useState } from "react";
import type { HealthPayload } from "./system-health-model";
import DepartmentHandoff from "./department-handoff";

function TwilioSmsTest() {
  const [test, setTest] = useState<{enabled:boolean;recipient:string;receipt:{status:string;requestId:string}|null}|null>(null);
  const [busy,setBusy] = useState(false), [confirmed,setConfirmed] = useState(false), [error,setError] = useState('');
  const refresh = useCallback(async () => {
    const response = await fetch('/api/twilio-sms-test',{cache:'no-store',signal:AbortSignal.timeout(20000)});
    if (response.status === 403) {setTest(null);return;}
    const result = await response.json();if (!response.ok) {setTest(null);throw new Error(result.error || 'SMS test status is unavailable.');}
    setTest(result);
  },[]);
  useEffect(() => {const timer = window.setTimeout(() => {void refresh().catch(() => setError('SMS test status is unavailable.'));},0);return () => window.clearTimeout(timer);},[refresh]);
  async function send() {
    if (busy || !confirmed || !test?.enabled || test.receipt) return;
    setBusy(true);setError('');
    try {
      const response = await fetch('/api/twilio-sms-test',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({confirmed:true}),signal:AbortSignal.timeout(40000)});
      const result = await response.json();if (!response.ok) throw new Error(result.error || 'The SMS attempt could not be confirmed.');
      await refresh();
    } catch (problem) {setError(problem instanceof Error ? problem.message : 'The SMS attempt could not be confirmed.');await refresh().catch(() => setTest(null));}
    finally {setBusy(false);}
  }
  if (!test && !error) return null;
  const status = test?.receipt?.status;
  const detail = status === 'Delivered' ? 'Twilio reports delivery to your phone. Please confirm you received it.' : status === 'Sent' ? 'Twilio sent the test; delivery is not yet confirmed.' : status === 'Accepted' ? 'Twilio accepted the test. Refresh status to check delivery.' : status === 'Failed' ? 'The test was refused or failed. It will not resend.' : status ? 'This attempt is saved but sending is unconfirmed. It will not resend.' : test?.enabled ? 'One manual attempt is available.' : 'Manual SMS testing is off or expired.';
  return <article className="content-card system-health-trust-note" style={{gridTemplateColumns:'minmax(0, 1fr)',gap:16}} aria-busy={busy}>
    <div><p className="eyebrow">Manual test only</p><h2>Twilio text message test</h2></div>
    <p>Recipient: <strong>{test?.recipient ?? 'Phone ending 5300'}</strong>. Uses one free trial message with Twilio’s preset Customer Support / Chat text. Automatic texts and emails stay off. Replies are not processed by Firehouse Manager.</p>
    <p role="status">{detail}</p>
    {test?.receipt ? <p style={{overflowWrap:'anywhere'}}>Test reference: {test.receipt.requestId}</p> : null}
    {test?.enabled && !test.receipt ? <><label><input type="checkbox" checked={confirmed} disabled={busy} onChange={event => setConfirmed(event.target.checked)} /> Send one free trial text only to my phone above.</label><div><button type="button" className="quiet-button" disabled={!confirmed || busy} onClick={() => void send()}>{busy ? 'Sending test…' : 'Send one free test text'}</button></div></> : null}
    {error ? <p role="alert">{error}</p> : null}
    <button type="button" className="quiet-button" disabled={busy} onClick={() => {setBusy(true);setError('');void refresh().catch(() => setError('SMS test status is unavailable.')).finally(() => setBusy(false));}}>Refresh text delivery status</button>
  </article>;
}

function OutlookEmailTest() {
  const [test, setTest] = useState<{enabled: boolean; recipient: string; receipt: {status: string; requestId: string} | null} | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState('');
  const refreshTest = useCallback(async () => {
    const response = await fetch('/api/outlook-email-test', {cache: 'no-store', signal: AbortSignal.timeout(10000)});
    if (response.status === 403) { setTest(null); return; }
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Email test status is unavailable.');
    setTest(result);
  }, []);
  useEffect(() => { const timer = window.setTimeout(() => { void refreshTest().catch(() => setError('Email test status is unavailable.')); }, 0); return () => window.clearTimeout(timer); }, [refreshTest]);
  async function sendTest() {
    if (!confirmed || busy || !test?.enabled || test.receipt) return;
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/outlook-email-test', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({confirmed: true}), signal: AbortSignal.timeout(30000)});
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'The email test could not be confirmed.');
      await refreshTest();
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'The test could not be confirmed.');
      await refreshTest().catch(() => setTest(null));
    } finally { setBusy(false); }
  }
  if (!test && !error) return null;
  return <article className="content-card system-health-trust-note" style={{gridTemplateColumns: 'minmax(0, 1fr)', gap: 16}} aria-busy={busy}>
    <div><p className="eyebrow">Manual test only</p><h2>Outlook email test</h2></div>
    <p>Recipient: <strong style={{overflowWrap: 'anywhere'}}>{test?.recipient ?? 'bwyant@stickneyfire.com'}</strong>. This sends one plain test message. It does not enable automatic notifications.</p>
    <p role="status">{test?.receipt ? test.receipt.status === 'Accepted' ? 'Outlook accepted this test. Check your inbox to verify delivery.' : 'This attempt is saved. Sending is unconfirmed; check your inbox. It will not resend.' : test?.enabled ? 'One manual attempt is available.' : 'Manual email testing is off.'}</p>
    {test?.receipt ? <p style={{overflowWrap: 'anywhere'}}>Test reference: {test.receipt.requestId}</p> : null}
    {test?.enabled && !test.receipt ? <><label><input type="checkbox" checked={confirmed} disabled={busy} onChange={event => setConfirmed(event.target.checked)} /> Send only to my email address above.</label><div><button type="button" className="quiet-button" disabled={!confirmed || busy} onClick={() => void sendTest()}>{busy ? 'Sending test…' : 'Send one test email'}</button></div></> : null}
    {error ? <p role="alert">{error}</p> : null}
    <button type="button" className="quiet-button" disabled={busy} onClick={() => {setError(''); void refreshTest().catch(() => setError('Email test status is unavailable.'));}}>Refresh email test status</button>
  </article>;
}

function checkedTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not checked" : departmentTimestamp(value);
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
    {permissions.includes('settings.manage') ? <><TwilioSmsTest /><OutlookEmailTest /></> : null}
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
