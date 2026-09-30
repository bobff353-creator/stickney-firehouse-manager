'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { startVisiblePolling } from './visible-poller';
import { HISTORY_PAGE_SIZE, type CheckReport, type HistoryPage, type HistoryReport } from './inventory-history';
import { rowValue as value, type InventoryRow } from './inventory-index';
import './inventory/history.css';

const formatStatus = (input: unknown) => String(input || '').replaceAll('_', ' ').replace(/^./, letter => letter.toUpperCase());
function displayNumericReading(input: unknown) {
  if (input == null || String(input).trim() === '') return '';
  const number = Number(input);
  return Number.isFinite(number) ? new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(number) : '';
}
const formatDate = (input: unknown) => {
  if (!input) return 'Not recorded';
  const date = new Date(String(input));
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', dateStyle: 'medium', timeStyle: 'short', hourCycle: 'h23' }).format(date) : 'Not recorded';
};
const emptyPage: HistoryPage = { reports: [], nextCursor: null };

function useHistoryPage(query: string, refresh: number, enabled = true) {
  const [state, setState] = useState({ ...emptyPage, query: '', loading: true, error: '' });
  useEffect(() => {
    if (!enabled) return;
    const poller = startVisiblePolling(async signal => {
      setState(current => ({ ...(current.query === query ? current : emptyPage), query, loading: true, error: '' }));
      try {
        const response = await fetch(`/api/operations/history?${query}`, { cache: 'no-store', signal: AbortSignal.any([signal, AbortSignal.timeout(20000)]) });
        const body = await response.json();
        if (!response.ok || !Array.isArray(body.reports)) throw Error(body.error || 'Could not load inspection history.');
        if (!signal.aborted) setState({ ...body, query, loading: false, error: '' });
      } catch (error) {
        if (!signal.aborted) setState(current => ({ ...current, query, loading: false, error: error instanceof Error ? error.message : 'Could not load inspection history.' }));
      }
    }, 240000);
    const requestRefresh = () => { void poller.refresh(); };
    window.addEventListener('firehouse:inventory-refresh', requestRefresh);
    return () => { poller.stop(); window.removeEventListener('firehouse:inventory-refresh', requestRefresh); };
  }, [query, refresh, enabled]);
  return state.query === query ? state : { ...emptyPage, loading: true, error: '' };
}

function Pager({ label, cursors, next, disabled, onChange }: {
  label: string; cursors: string[]; next: string | null; disabled: boolean; onChange: (cursors: string[]) => void;
}) {
  return <nav className="history-pager" aria-label={label}>
    <button type="button" disabled={disabled || cursors.length === 1} onClick={() => onChange(cursors.slice(0, -1))}>← Previous</button>
    <span>Page {cursors.length} · up to {HISTORY_PAGE_SIZE} reports</span>
    <button type="button" disabled={disabled || !next} onClick={() => next && onChange([...cursors, next])}>Next →</button>
  </nav>;
}

export function InventoryAirHistory({ equipmentId }: { equipmentId: string }) {
  const [open, setOpen] = useState(false);
  const [cursors, setCursors] = useState(['']);
  const [refresh, setRefresh] = useState(0);
  const page = useHistoryPage(new URLSearchParams({ asset: equipmentId, cursor: cursors.at(-1)! }).toString(), refresh, open);
  return <details className="air-record" onToggle={event => setOpen(event.currentTarget.open)}>
    <summary>Inspection history · browse linked entries</summary>
    {open && <>
      <p>Up to {HISTORY_PAGE_SIZE} linked entries per page. Older reports without this equipment ID remain in Reports.</p>
      {page.loading ? <p role="status">Loading linked inspections…</p> : page.error ? <p role="alert">{page.error} <button type="button" onClick={() => setRefresh(n => n + 1)}>Retry history</button></p> : page.reports.length ? page.reports.map(entry => <p key={entry.id}><strong>{formatStatus(entry.result)}</strong> · {value(entry,'label')} · {value(entry,'location_snapshot')}<br/>{entry.checked_at ? formatDate(entry.checked_at) : 'Not yet checked'} · {value(entry,'notes') || 'No note'}</p>) : <p>No linked inspections on this page.</p>}
      <Pager label="Air asset history pages" cursors={cursors} next={page.nextCursor} disabled={page.loading} onChange={setCursors}/>
    </>}
  </details>;
}

export default function InventoryReports({ apparatus, canReview, busy, onReview, children }: {
  apparatus: InventoryRow[]; canReview: boolean; busy: boolean; children?: ReactNode;
  onReview: (id: string, decision: string, notes: string) => Promise<boolean>;
}) {
  const [filters, setFilters] = useState({ apparatus: '', type: '', review: '', from: '', to: '' });
  const [cursors, setCursors] = useState(['']);
  const [reviewCursors, setReviewCursors] = useState(['']);
  const [refresh, setRefresh] = useState(0);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [detail, setDetail] = useState<CheckReport | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [lastRequest, setLastRequest] = useState<{ id: string; output: 'view' | 'print' | 'email' } | null>(null);
  const [output, setOutput] = useState<'view' | 'print' | 'email'>('view');
  const reportDetailRef = useRef<HTMLElement>(null);
  const request = useRef<AbortController | null>(null);
  const history = useHistoryPage(new URLSearchParams({ ...filters, cursor: cursors.at(-1)! }).toString(), refresh);
  const reviews = useHistoryPage(new URLSearchParams({ review: 'pending', cursor: reviewCursors.at(-1)! }).toString(), refresh, canReview);
  const changeFilter = (key: keyof typeof filters, input: string) => { setFilters(current => ({ ...current, [key]: input })); setCursors(['']); };
  useEffect(() => () => request.current?.abort(), []);

  async function openReport(id: string, purpose: 'view' | 'print' | 'email' = 'view') {
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    setLastRequest({ id, output: purpose }); setDetail(null); setDetailLoading(true); setDetailError(''); setOutput('view');
    try {
      const response = await fetch(`/api/operations/history?check=${encodeURIComponent(id)}`, { cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]) });
      const body = await response.json();
      if (!response.ok || body.check?.id !== id || !Array.isArray(body.items)) throw Error(body.error || 'Could not load the complete report.');
      if (!controller.signal.aborted) { setDetail(body); setOutput(purpose); }
    } catch (error) {
      if (!controller.signal.aborted) setDetailError(error instanceof Error ? error.message : 'Could not load the complete report.');
    } finally { if (!controller.signal.aborted) setDetailLoading(false); }
  }

  useEffect(() => {
    if (!detail) return;
    reportDetailRef.current?.scrollIntoView({ block: 'start', behavior: 'auto' });
    reportDetailRef.current?.focus({ preventScroll: true });
    if (output === 'view') return;
    // Printing and mail preparation happen only after the entire report is rendered.
    const timer = window.setTimeout(() => {
      if (output === 'print') window.print();
      else {
        const { check, items } = detail;
        const subject = `${value(check, 'apparatus_name')} ${formatStatus(check.check_type)} check report`;
        const body = ['Stickney Fire Department — Vehicle Checks & Inventory', `Report: ${check.id}`,
          `Apparatus: ${value(check, 'apparatus_name')}`, `Check: ${formatStatus(check.check_type)}`,
          `Started: ${formatDate(check.started_at)}`, `Completed: ${formatDate(check.completed_at)}`,
          `Completed by: ${value(check, 'started_by') || 'Not recorded'}`, `Review: ${formatStatus(check.review_status)}`,
          `Items: ${items.length} · Passed: ${items.filter(i => i.result === 'pass').length} · Issues: ${items.filter(i => ['failed','missing','damaged'].includes(value(i,'result'))).length}`, '',
          ...items.filter(i => i.result !== 'pass').map(i => `${value(i, 'equipment_name')}: ${formatStatus(i.result)}${i.notes ? ` — ${i.notes}` : ''}`),
        ].join('\n');
        window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      }
      setOutput('view');
    }, 80);
    return () => window.clearTimeout(timer);
  }, [detail, output]);

  async function review(check: HistoryReport, decision: string) {
    if (!await onReview(check.id, decision, notes[check.id] || '')) return;
    setNotes(current => { const next = { ...current }; delete next[check.id]; return next; });
    setReviewCursors(['']); setCursors(['']); setRefresh(current => current + 1);
    if (detail?.check.id === check.id) void openReport(check.id);
  }

  const stateMessage = (page: ReturnType<typeof useHistoryPage>) => page.error
    ? <div className="ops-error" role="alert">{page.error} <button type="button" onClick={() => setRefresh(current => current + 1)}>Retry history</button></div>
    : page.loading ? <p role="status">Loading reports…</p> : null;
  const reading = (item: InventoryRow) => value(item, 'section')
    ? [item.harness_number ? `Harness ${item.harness_number}` : '', item.cylinder_number ? `Cylinder ${item.cylinder_number}` : '', item.psi != null ? `${item.psi} PSI` : '', value(item, 'notes')].filter(Boolean).join(' · ') || '—'
    : displayNumericReading(item.numeric_reading) || value(item, 'notes') || '—';
  const unavailable = busy || detailLoading;

  return <div className="inventory-reports-workspace">
    {canReview && <section className="ops-card check-approval-card" aria-label="Pending check reviews">
      <header><div><span>ADMINISTRATOR APPROVALS</span><h2>Completed checks awaiting review</h2></div><b>{reviews.loading || reviews.error ? '—' : `${reviews.reports.length} on this page`}</b></header>
      {reviews.reports.length > 5 && <Pager label="Review page controls" cursors={reviewCursors} next={reviews.nextCursor} disabled={unavailable || reviews.loading} onChange={setReviewCursors}/>}
      {stateMessage(reviews)}
      {!reviews.loading && !reviews.error && <>{reviews.reports.length ? <div className="check-approval-list">{reviews.reports.map(check => <article key={check.id}>
        <div><span>{formatStatus(check.check_type)} check</span><h3>{value(check,'apparatus_name')}</h3><small>Completed {formatDate(check.completed_at)} by {value(check,'started_by') || 'department crew'}</small></div>
        <dl><div><dt>Items</dt><dd>{check.item_count}</dd></div><div><dt>Passed</dt><dd>{check.passed_count}</dd></div><div><dt>Issues</dt><dd>{check.issue_count}</dd></div></dl>
        <label>Administrator review note<textarea rows={2} value={notes[check.id] || ''} onChange={event => setNotes(current => ({ ...current, [check.id]: event.target.value }))} placeholder="Required when returning for correction" /></label>
        <div className="check-review-actions"><button type="button" disabled={unavailable} onClick={() => void openReport(check.id)}>Review report</button><button type="button" disabled={unavailable} onClick={() => void review(check,'changes_requested')}>Request changes</button><button className="ops-primary" type="button" disabled={unavailable} onClick={() => void review(check,'approved')}>Approve check</button></div>
      </article>)}</div> : <p>{reviewCursors.length === 1 ? 'All completed checks are reviewed.' : 'No pending reviews remain on this page. Use Previous or refresh the history.'}</p>}</>}
      <Pager label="Review pages" cursors={reviewCursors} next={reviews.nextCursor} disabled={unavailable || reviews.loading} onChange={setReviewCursors}/>
    </section>}
    <section className="ops-card inventory-report-history" aria-label="Inspection history">
      <header><div><span>REPORTS</span><h2>Vehicle checks and inventory history</h2></div><b>{history.loading || history.error ? '—' : `${history.reports.length} on this page`}</b></header>
      <p className="report-help">Browse {HISTORY_PAGE_SIZE} reports at a time, newest started first. Open a report for every saved result. Date filters use the completion date in department time. Email opens a prepared summary in your device&apos;s email application.</p>
      <div className="history-filters">
        <label>Apparatus<select aria-label="Apparatus" value={filters.apparatus} onChange={event => changeFilter('apparatus',event.target.value)}><option value="">All apparatus</option>{apparatus.map(row => <option key={value(row,'id')} value={value(row,'id')}>{value(row,'name')}</option>)}</select></label>
        <label>Check type<select aria-label="Check type" value={filters.type} onChange={event => changeFilter('type',event.target.value)}><option value="">All check types</option>{['daily','weekly','inventory','air_pack'].map(type => <option key={type} value={type}>{formatStatus(type)}</option>)}</select></label>
        <label>Approval<select aria-label="Approval" value={filters.review} onChange={event => changeFilter('review',event.target.value)}><option value="">All approvals</option>{['pending','approved','changes_requested'].map(status => <option key={status} value={status}>{formatStatus(status)}</option>)}</select></label>
        <label>Completed from<input type="date" value={filters.from} onChange={event => changeFilter('from',event.target.value)}/></label>
        <label>Completed through<input type="date" value={filters.to} onChange={event => changeFilter('to',event.target.value)}/></label>
        <button type="button" onClick={() => { setFilters({apparatus:'',type:'',review:'',from:'',to:''}); setCursors(['']); }}>Clear filters</button>
        <button type="button" disabled={history.loading || busy} onClick={() => { setCursors(['']); setReviewCursors(['']); setRefresh(current => current + 1); }}>Refresh history</button>
      </div>
      {stateMessage(history)}
      <Pager label="History page controls" cursors={cursors} next={history.nextCursor} disabled={unavailable || history.loading} onChange={setCursors}/>
      {!history.loading && !history.error && <>{history.reports.length ? <div className="inventory-report-list">{history.reports.map(check => <article key={check.id}>
        <div><span>{formatStatus(check.check_type)}</span><h3>{value(check,'apparatus_name')}</h3><small>{formatDate(check.completed_at)} · {check.item_count} items · {check.issue_count} issues</small></div>
        <b className={`review-${value(check,'review_status')}`}>{formatStatus(check.review_status)}</b>
        <div><button type="button" disabled={unavailable} onClick={() => void openReport(check.id)}>View</button><button type="button" disabled={unavailable} onClick={() => void openReport(check.id,'print')}>Print</button><button type="button" disabled={unavailable} onClick={() => void openReport(check.id,'email')}>Email summary</button></div>
      </article>)}</div> : <div className="ops-empty"><strong>No reports on this page.</strong><p>Adjust the filters, use Previous, or refresh to see the latest completed checks.</p></div>}</>}
      <Pager label="History pages" cursors={cursors} next={history.nextCursor} disabled={unavailable || history.loading} onChange={setCursors}/>
    </section>
    {children}
    {detailLoading && <p role="status">Loading the complete report…</p>}
    {detailError && <div role="alert" className="ops-error">{detailError} <button type="button" onClick={() => lastRequest && void openReport(lastRequest.id,lastRequest.output)}>Retry report</button></div>}
    {detail && <section ref={reportDetailRef} tabIndex={-1} aria-label="Selected check report" className="ops-card inventory-report-detail inventory-report-print-host">
      <header><div><span>STICKNEY FIRE DEPARTMENT · CHECK REPORT</span><h2>{value(detail.check,'apparatus_name')} · {formatStatus(detail.check.check_type)}</h2></div><button type="button" onClick={() => { request.current?.abort(); setDetail(null); setOutput('view'); }}>Close</button></header>
      <div className="report-metadata"><span><b>Report ID</b>{detail.check.id}</span><span><b>Started</b>{formatDate(detail.check.started_at)}</span><span><b>Completed</b>{formatDate(detail.check.completed_at)}</span><span><b>Completed by</b>{value(detail.check,'started_by') || 'Not recorded'}</span><span><b>Approval</b>{formatStatus(detail.check.review_status)}</span><span><b>Reviewed by</b>{value(detail.check,'reviewed_by') || 'Pending'}</span></div>
      {detail.check.review_notes && <blockquote>{detail.check.review_notes}</blockquote>}
      <table><thead><tr><th>Equipment</th><th>Location</th><th>Result</th><th>Reading / notes</th><th>Checked by</th></tr></thead><tbody>{detail.items.map(item => <tr key={value(item,'id')}><td data-label="Equipment">{value(item,'equipment_name')}</td><td data-label="Location">{value(item,'compartment_label')}</td><td data-label="Result">{formatStatus(item.result)}</td><td data-label="Reading / notes">{reading(item)}</td><td data-label="Checked by">{value(item,'checked_by') || '—'}</td></tr>)}</tbody></table>
      <footer><span>{detail.items.length} items</span><span>{detail.items.filter(item => item.result === 'pass').length} passed</span><span>{detail.items.filter(item => ['failed','missing','damaged'].includes(value(item,'result'))).length} issues</span></footer>
      <div className="report-detail-actions"><button type="button" onClick={() => void openReport(detail.check.id,'print')}>Print report</button><button type="button" onClick={() => void openReport(detail.check.id,'email')}>Email summary</button></div>
    </section>}
  </div>;
}
