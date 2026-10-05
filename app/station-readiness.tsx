'use client';
import { useEffect, useState } from 'react';
import type { OperationsReadiness } from './operations-readiness';
import './station-readiness.css';

export default function StationReadiness({ issues = [], reportsDelayed = false }: { issues?: Array<{ id?: string; item: string; status: string; detail: string }>; reportsDelayed?: boolean }) {
  const [summary, setSummary] = useState<OperationsReadiness | null>(null);
  const [failed, setFailed] = useState(false);
  const [confirmedAt, setConfirmedAt] = useState(0);
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => {
    let active = true;
    let pending = false;
    const controller = new AbortController();
    const load = async () => {
      if (pending || !active) return;
      pending = true;
      try {
        const response = await fetch('/api/operations/summary', { cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]) });
        if (!active) return;
        if ([401, 403, 423].includes(response.status)) { setSummary(null); setConfirmedAt(0); }
        if (!response.ok) throw Error('Readiness unconfirmed');
        const packet = await response.json() as OperationsReadiness;
        if (active) { setSummary(packet); setConfirmedAt(Date.now()); setFailed(false); }
      } catch { if (active) setFailed(true); }
      finally { pending = false; }
    };
    void load();
    const refresh = window.setInterval(() => void load(), 240000);
    const ticker = window.setInterval(() => setClock(Date.now()), 30000);
    return () => { active = false; controller.abort(); window.clearInterval(refresh); window.clearInterval(ticker); };
  }, []);
  const reports = issues.length > 0 ? <section className="station-shift-reports" aria-label="Shift equipment reports"><h3>Equipment reports · {issues.length}{reportsDelayed ? ' · update delayed' : ''}</h3>{[...issues].sort((a, b) => Number(/critical|high priority/i.test(b.status)) - Number(/critical|high priority/i.test(a.status))).slice(0, 3).map((issue, index) => <article key={issue.id || `${issue.item}-${index}`}><strong>{issue.item}</strong><span>{issue.status}</span><p>{issue.detail || "No details entered"}</p></article>)}{issues.length > 3 && <p>{issues.length - 3} more reports · review Daily Log and Operations for all details.</p>}</section> : null;
  if (!summary) return <div className="station-readiness unconfirmed" role="status"><h3>Operations readiness not confirmed</h3><p>{failed ? 'The records could not be verified. Open Operations to retry.' : 'Loading saved check, asset, repair and stock records.'}</p>{reports}</div>;
  const delayed = failed || clock - confirmedAt > 300000;
  return <div className={`station-readiness${delayed ? ' unconfirmed' : ''}`} aria-label="Station readiness">
    <p className="station-readiness-source">{delayed ? 'UPDATE DELAYED · Last confirmed records' : 'SAVED OPERATIONS RECORDS'}</p>
    <div className="station-readiness-grid">
      {[
        [summary.inProgressChecks, 'Checks underway'], [summary.assetAttention, 'Assets need attention'],
        [summary.openRepairs, 'Open work orders'], [summary.lowStock, 'Supplies at reorder level'],
        [summary.expiredStock, 'Supplies with expired lots'], [summary.assetUnknown + summary.unknownStock, 'Records with dates to verify'],
      ].map(([count, label]) => <article key={label} className={Number(count) > 0 ? 'attention' : ''}><strong>{count}</strong><span>{label}</span></article>)}
    </div>{reports}<p>Required checks remain in the checks section. Counts do not certify equipment ready for use.</p>
    <small>Confirmed {new Date(confirmedAt).toLocaleTimeString('en-US', { timeZone: 'America/Chicago', hour: 'numeric', minute: '2-digit' })}</small>
  </div>;
}
