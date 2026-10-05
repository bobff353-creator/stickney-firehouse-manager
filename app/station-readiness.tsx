'use client';
import { useEffect, useState } from 'react';
import type { OperationsReadiness } from './operations-readiness';
import './station-readiness.css';

export default function StationReadiness() {
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
  if (!summary) return <div className="station-readiness unconfirmed" role="status"><h3>Operations readiness not confirmed</h3><p>{failed ? 'The records could not be verified. Open Operations to retry.' : 'Loading saved check, asset, repair and stock records.'}</p></div>;
  const delayed = failed || clock - confirmedAt > 300000;
  return <div className={`station-readiness${delayed ? ' unconfirmed' : ''}`} aria-label="Station readiness">
    <p className="station-readiness-source">{delayed ? 'UPDATE DELAYED · Last confirmed records' : 'SAVED OPERATIONS RECORDS'}</p>
    <div className="station-readiness-grid">
      {[
        [summary.inProgressChecks, 'Checks underway'], [summary.assetAttention, 'Assets need attention'],
        [summary.openRepairs, 'Open work orders'], [summary.lowStock, 'Supplies at reorder level'],
        [summary.expiredStock, 'Supplies with expired lots'], [summary.assetUnknown + summary.unknownStock, 'Records with dates to verify'],
      ].map(([count, label]) => <article key={label} className={Number(count) > 0 ? 'attention' : ''}><strong>{count}</strong><span>{label}</span></article>)}
    </div><p>Required checks remain in the checks section. Counts do not certify equipment ready for use.</p>
    <small>Confirmed {new Date(confirmedAt).toLocaleTimeString('en-US', { timeZone: 'America/Chicago', hour: 'numeric', minute: '2-digit' })}</small>
  </div>;
}
