'use client';
import { useState, type MouseEvent } from 'react';
import { pageSlug, type PortalPage } from './portal-navigation';
import { chiefSummary, reportRange, restoredReportRange, type AnalyticsSources, type ReportDay } from './reporting-metrics';
import { parseSavedTime } from './workflow-status';
import './reporting.css';
export type ReportData = { daily: ReportDay[]; sources: AnalyticsSources; coverage: { earliest: string; latest: string }; generatedAt: string; integrations: { cad: { state: string; credentialsConfigured: boolean | null; receipts: Array<{ status: string; count: number; latest: string }>; liveVerified: boolean }; neris: { state: string }; ai: { state: string; note: string } } };
export type ReportNavigation = (page: PortalPage) => void;
export function ChiefReport({ data, stale, onNavigate }: { data: ReportData; stale: boolean; onNavigate?: ReportNavigation }) {
  // This report mounts after Command Center loads its records in the browser.
  const [initial] = useState(() => restoredReportRange(typeof window === 'undefined' ? '' : window.location.search, data.coverage.earliest, data.coverage.latest));
  const [start, setStart] = useState(initial.start), [end, setEnd] = useState(initial.end), [downloadError, setDownloadError] = useState(''), [busy, setBusy] = useState(false);
  function changeDates(nextStart: string, nextEnd: string) {
    setStart(nextStart); setEnd(nextEnd);
    const url = new URL(window.location.href);
    url.searchParams.set('reportStart', nextStart); url.searchParams.set('reportEnd', nextEnd);
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
  }
  function sourceLink(event: MouseEvent<HTMLAnchorElement>, page: PortalPage) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (onNavigate) { event.preventDefault(); onNavigate(page); }
  }
  let rangeError = ''; try { reportRange(start, end, data.coverage.earliest, data.coverage.latest); } catch (error) { rangeError = error instanceof Error ? error.message : 'Invalid dates.'; }
  const summary = rangeError ? [] : chiefSummary(data.daily, data.sources, start, end);
  async function download() {
    if (rangeError || stale) return;
    setBusy(true); setDownloadError('');
    try {
      const response = await fetch(`/api/command-center?format=csv&start=${start}&end=${end}`, { cache: 'no-store' });
      if (!response.ok) { const result = await response.json(); throw Error(result.error || 'Report download unavailable.'); }
      const url = URL.createObjectURL(await response.blob()), link = document.createElement('a'); link.href = url; link.download = `chief-report-${start}-${end}.csv`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) { setDownloadError(error instanceof Error ? error.message : 'Report download unavailable.'); } finally { setBusy(false); }
  }
  return <section className="chief-report content-card"><header><div><p className="eyebrow">Saved department records</p><h2>Chief’s report</h2><p>Choose a date range and follow each total back to its source.</p></div><span>Updated {new Date(data.generatedAt).toLocaleString()}</span></header>
    <div className="report-filters"><label>Report start date<input type="date" value={start} min={data.coverage.earliest} max={data.coverage.latest} onInput={event => changeDates(event.currentTarget.value, end)} onChange={event => changeDates(event.target.value, end)}/></label><label>Report end date<input type="date" value={end} min={data.coverage.earliest} max={data.coverage.latest} onInput={event => changeDates(start, event.currentTarget.value)} onChange={event => changeDates(start, event.target.value)}/></label><button type="button" disabled={!!rangeError || stale || busy} onClick={() => void download()}>{busy ? 'Preparing…' : 'Download chief report CSV'}</button><button type="button" disabled={!!rangeError || stale} onClick={() => window.print()}>Print chief report</button></div>
    <p className="report-note">{start} through {end} · Inclusive Daily Log / payroll work dates. Only saved records are counted. Missing days do not prove no activity. CSV reloads current authorized records; its timestamp may differ from this view.</p>
    {(rangeError || downloadError || stale) && <p role="alert">{rangeError || downloadError || 'This report may be out of date. Retry Command Center before downloading or printing.'}</p>}
    <div className="chief-metrics">{summary.map(metric => <article key={metric.key}><span>{metric.label}</span><strong>{metric.value === null ? metric.state === 'restricted' ? 'Restricted' : 'Unavailable' : metric.key === 'payrollCost' ? metric.value.toLocaleString('en-US', { style: 'currency', currency: 'USD' }) : metric.value.toLocaleString('en-US', { maximumFractionDigits: 1 })}</strong><p>{metric.definition}</p>{metric.state === 'ready' && <a href={metric.href} onClick={event => sourceLink(event, metric.href.includes('page=payroll') ? 'Payroll' : 'Daily Log')}>Open source records →</a>}</article>)}</div>
    <details className="report-note"><summary>Metrics requiring additional reporting sources</summary><p>Response and turnout intervals, training compliance, inspection completion, fleet downtime, unique repair tickets and inventory spending are not measured here. Use their source modules to review individual records.</p></details>
    <section className="connect-summary"><h3>Firehouse Connect</h3><p>Integration readiness is separate from report totals.</p><div className="connect-grid"><article><h4>CAD / CIS</h4>{data.integrations.cad.state === 'restricted' ? <p>Restricted · integration settings require administrator access.</p> : data.integrations.cad.state === 'unavailable' ? <p>Receipt history unavailable. Retry to inspect saved deliveries.</p> : <><p>App credentials {data.integrations.cad.credentialsConfigured ? 'configured' : 'not configured'} · end-to-end vendor delivery unverified.</p>{data.integrations.cad.receipts.map(receipt => <p key={receipt.status}>{receipt.status}: {Number(receipt.count).toLocaleString()} saved app receipts · latest {parseSavedTime(receipt.latest)?.toLocaleString('en-US', { timeZone: 'America/Chicago' }) || 'time unavailable'} Central</p>)}{!data.integrations.cad.receipts.length && <p>No CIS receipts saved. This does not prove the CAD service is disconnected.</p>}<a href={`/?display=portal&page=${pageSlug('CAD Integration')}`} onClick={event => sourceLink(event, 'CAD Integration')}>Open integration settings →</a></>}</article><article><h4>NERIS</h4><p>Not connected · local review and downloads only. No official submissions or acceptance receipts.</p><a href="https://github.com/ulfsri/neris-api-client" target="_blank" rel="noreferrer">Official API integration reference ↗</a></article><article><h4>AI assistance</h4><p>Not enabled. {data.integrations.ai.note}</p></article></div></section>
  </section>;
}
