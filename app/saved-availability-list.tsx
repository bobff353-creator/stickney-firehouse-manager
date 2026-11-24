"use client";

import { useRef, useState } from 'react';
import { savedAvailabilityPage, type SavedAvailabilityFilters } from './saved-availability';
import { scheduleMonthRange } from './schedule-setup-model';
import { scheduleDateOffset } from './scheduler-overview';

type Entry = { id: string; availabilityDate: string; status: 'available' | 'unavailable'; allDay: number; startTime: string; endTime: string; note: string };
type Props<T extends Entry> = { entries: T[]; memberName: string; month: string; today: string; busy: boolean; initialQuery?: string; onEdit: (entry: T) => void; onRemove: (entry: T) => void };
const label = (date: string) => new Date(date + 'T12:00:00Z').toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

export default function SavedAvailabilityList<T extends Entry>({ entries, memberName, month, today, busy, initialQuery = '', onEdit, onRemove }: Props<T>) {
  const initial: SavedAvailabilityFilters = { period: 'month', status: 'all', query: '', from: month + '-01', through: scheduleMonthRange(month)?.through || today };
  const [filters, setFilters] = useState({ ...initial, query: initialQuery });
  const [page, setPage] = useState(1);
  const [selectedMonth, setSelectedMonth] = useState(month);
  const listTitle = useRef<HTMLHeadingElement>(null);
  const changePage = (next: number) => { setPage(next); listTitle.current?.focus(); };
  const update = (change: Partial<SavedAvailabilityFilters>) => { setFilters(value => ({ ...value, ...change })); setPage(1); };
  const result = savedAvailabilityPage(entries, filters, selectedMonth, today, page);
  const monthLabel = scheduleMonthRange(selectedMonth) ? new Date(selectedMonth + '-01T12:00:00Z').toLocaleDateString('en-US', { timeZone: 'UTC', month: 'long', year: 'numeric' }) : 'Choose a month';
  return <section className="availability-saved-list" aria-label="Saved availability entries">
    <div className="entry-head"><div><span className="section-kicker">Saved availability</span><h3 ref={listTitle} tabIndex={-1}>{memberName}</h3></div><span>{result.total} entries in this list</span></div>
    <p className="muted">Shows the calendar month by default, 10 entries at a time. Change Dates to find another date. Filters do not change saved records.</p>
    <p className="muted">This list includes dates from {label(scheduleDateOffset(today, -45))} onward. Earlier records remain saved.</p>
    <div className="availability-list-filters">
      <label>Dates<select value={filters.period} onChange={event => update({ period: event.target.value as SavedAvailabilityFilters['period'] })}>
        <option value="month">Calendar month · {monthLabel}</option><option value="upcoming">Today and later</option><option value="all">All dates in this list</option><option value="custom">Choose a date range</option>
      </select></label>
      {filters.period === 'month' && <label>Month<input type="month" value={selectedMonth} onChange={event => { const next = event.target.value; setSelectedMonth(next); const range = scheduleMonthRange(next); update({ query: '', from: range?.from || '', through: range?.through || '' }); }} /></label>}
      <label>Entry type<select value={filters.status} onChange={event => update({ status: event.target.value as SavedAvailabilityFilters['status'] })}>
        <option value="all">All entry types</option><option value="available">Available</option><option value="unavailable">Previously saved unavailable</option>
      </select></label>
      <label>Find a saved entry<input type="search" value={filters.query} onChange={event => update({ query: event.target.value })} placeholder="Date (YYYY-MM-DD) or note" /></label>
      {filters.period === 'custom' && <><label>Saved entries from<input type="date" value={filters.from} onChange={event => update({ from: event.target.value })} /></label><label>Saved entries through<input type="date" min={filters.from || undefined} value={filters.through} onChange={event => update({ through: event.target.value })} /></label></>}
    </div>
    <div className="availability-list-summary"><p role="status">{result.matching} matching · Showing {result.first}–{result.last} of {result.matching}</p><button type="button" className="link" onClick={() => { setSelectedMonth(month); setFilters(initial); setPage(1); }}>Reset to calendar month</button></div>
    {result.error && <p role="alert" className="sf-message sf-error">{result.error}</p>}
    {!result.matching && !result.error && <p className="muted">{entries.length ? 'No entries match these filters. Choose All dates in this list or reset the filters.' : 'No availability entries are available in this list.'}</p>}
    <div className="availability-compact-entries">
      {result.rows.map(entry => <article key={entry.id} className={`availability-entry ${entry.status}`}>
        <div><b>{label(entry.availabilityDate)}</b><span>{entry.status === 'available' ? 'Available' : 'Previously saved unavailable'} · {entry.allDay ? 'All day' : `${entry.startTime}–${entry.endTime}${entry.endTime <= entry.startTime ? ' · ends next day' : ''}`}</span>
          {entry.note && <details><summary>View note</summary><p>{entry.note}</p></details>}</div>
        <div className="row-actions">{entry.status === 'available' && <button type="button" className="link" disabled={busy} aria-label={`Edit availability for ${entry.availabilityDate}`} onClick={() => onEdit(entry)}>Edit</button>}
          <button type="button" className="link danger" disabled={busy} aria-label={`Remove availability for ${entry.availabilityDate}`} onClick={() => onRemove(entry)}>Remove</button></div>
      </article>)}
    </div>
    {result.pages > 1 && <nav className="availability-list-pages" aria-label="Saved availability pages"><button type="button" className="link" disabled={result.page === 1} onClick={() => changePage(result.page - 1)}>Previous entries</button><span>Page {result.page} of {result.pages}</span><button type="button" className="link" disabled={result.page === result.pages} onClick={() => changePage(result.page + 1)}>Next entries</button></nav>}
  </section>;
}
