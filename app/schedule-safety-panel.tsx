"use client";
import { useMemo, useState } from 'react';
import { useUnsavedWork } from './use-unsaved-work';
import { emptyScheduleSafetyRules, scheduleSafetyIssues, validateScheduleSafetyRules, type SafetySlot, type SafetyMember } from './schedule-safety';
import type { SavedScheduleSafety } from './schedule-safety-store';
import './schedule-safety.css';

export function ScheduleSafetyPanel({ slots, members, saved, today, canEdit, busy, onSave, onDay }: {
  slots: SafetySlot[]; members: SafetyMember[]; saved?: SavedScheduleSafety; today: string; canEdit: boolean; busy: boolean;
  onSave: (body: Record<string, unknown>) => Promise<unknown>; onDay: (date: string) => void;
}) {
  const [from, setFrom] = useState(today);
  const [through, setThrough] = useState('');
  const [filter, setFilter] = useState('all');
  const [draft, setDraft] = useState<{ rest: string; continuous: string; revision: string } | null>(null);
  const rest = draft?.rest ?? saved?.rules.minimumRestHours?.toString() ?? '';
  const continuous = draft?.continuous ?? saved?.rules.maximumContinuousHours?.toString() ?? '';
  const revision = draft?.revision ?? saved?.revision ?? '';
  const dirty = draft !== null;
  const [error, setError] = useState('');
  useUnsavedWork(dirty, busy && dirty);
  const issues = useMemo(() => scheduleSafetyIssues(slots, members, saved?.rules || emptyScheduleSafetyRules(), from, through), [slots, members, saved, from, through]);
  const visible = issues.filter(issue => filter === 'all' || issue.kind === filter);
  async function save() {
    setError('');
    try {
      const rules = validateScheduleSafetyRules({ minimumRestHours: rest.trim() ? Number(rest) : null, maximumContinuousHours: continuous.trim() ? Number(continuous) : null });
      const result = await onSave({ action: 'saveScheduleSafety', revision, rules });
      if (result) setDraft(null);
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to save review rules.'); }
  }
  return <section className="schedule-safety" aria-label="Schedule review">
    <header><div><h2>Schedule review</h2><p>Review saved assignments before relying on coverage. Flags do not approve, remove or change a shift.</p></div><strong>{issues.length} {issues.length === 1 ? 'flag' : 'flags'}</strong></header>
    <div className="schedule-safety-filters">
      <label>From<input type="date" value={from} onChange={event => setFrom(event.target.value)} /></label>
      <label>Through<input type="date" min={from} value={through} onChange={event => setThrough(event.target.value)} /></label>
      <label>Show review flags<select value={filter} onChange={event => setFilter(event.target.value)}><option value="all">All flags</option><option value="overlap">Overlapping assignments</option><option value="qualification">Qualifications</option><option value="rest">Rest between tours</option><option value="continuous">Continuous hours</option><option value="invalid">Dates or times to verify</option></select></label>
    </div>
    {through && from > through ? <p role="alert">Through must be on or after From.</p> : <>
      {!visible.length && <p role="status">No matching review flags in the loaded assignments. This does not certify staffing or fitness for duty.</p>}
      <ul>{visible.slice(0, 100).map(issue => <li key={issue.id}><div><strong>{issue.employeeName}</strong><span>{issue.date} · {issue.message}</span></div><button type="button" onClick={() => onDay(issue.date)}>Review day →</button></li>)}</ul>
      {visible.length > 100 && <p>{visible.length - 100} more flags. Narrow the dates or flag type to review them.</p>}
    </>}
    <details><summary>Department fatigue review rules</summary>
      <p>Advisory flags use saved local clock hours and combine adjoining tours. They do not enforce union rules, calculate elapsed daylight-saving time, measure actual duty, or change paid hours. Overlap and qualification review stays on.</p>
      <div className="schedule-safety-filters">
        <label>Minimum rest between tours (hours, up to 72)<input type="number" min="0.25" max="72" step="0.25" value={rest} disabled={!canEdit || busy} onChange={event => setDraft({ rest: event.target.value, continuous, revision })} placeholder="Not set" /></label>
        <label>Maximum continuous tour (hours, up to 168)<input type="number" min="0.25" max="168" step="0.25" value={continuous} disabled={!canEdit || busy} onChange={event => setDraft({ rest, continuous: event.target.value, revision })} placeholder="Not set" /></label>
      </div>
      <p>Leave a limit blank to turn that review flag off. Saved rest limit: {saved?.rules.minimumRestHours ?? 'not set'}; continuous limit: {saved?.rules.maximumContinuousHours ?? 'not set'}.</p>
      {saved?.revision !== revision && dirty && <p role="alert">Saved rules changed while you were editing. Copy your draft values, then refresh before saving.</p>}
      {error && <p role="alert">{error}</p>}
      {canEdit && <button type="button" disabled={!dirty || busy || !saved} onClick={() => void save()}>{busy ? 'Saving…' : 'Save review rules'}</button>}
      {dirty && <button type="button" disabled={busy} onClick={() => { setDraft(null); setError(''); }}>Discard draft rules</button>}
    </details>
  </section>;
}
