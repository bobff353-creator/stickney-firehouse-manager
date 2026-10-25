'use client';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { isMarkedUsfaTestRecord } from './lib/usfa-records';

export type UsfaFatality = { id: number; name: string; department: string; location: string; deathDate: string; url: string };
export type UsfaData = { year: number; total: number; items: UsfaFatality[]; excludedTestRecords?: number; stale?: boolean };

// Reserve room for a wrapped name, department, and city/state in each TV card.
export function fatalityPage<T>(items: T[], height: number, pageIndex: number) {
  const capacity = Math.max(1, Math.floor((height + 4) / 112));
  const pages = Math.max(1, Math.ceil(items.length / capacity));
  const index = pageIndex % pages;
  const start = index * capacity;
  return { items: items.slice(start, start + capacity), start, pages };
}

function sourceText(value: string, missing: string) {
  return typeof value === 'string' && value.trim() ? value.trim() : missing;
}

const emptyReports: UsfaFatality[] = [];

export default function BoardFatalities({ data, tvMode, active, updatedLabel }: {
  data: UsfaData | null | undefined; tvMode: boolean; active: boolean; updatedLabel: string;
}) {
  const list = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);
  const [pageIndex, setPageIndex] = useState(0);
  const available = Boolean(data);
  useEffect(() => {
    const element = list.current;
    if (!tvMode || !active || !element) return;
    const observer = new ResizeObserver(entries => {
      const next = entries[0]?.contentRect.height ?? 0;
      if (next > 0) setHeight(next);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [tvMode, active, available]);

  const sourceItems = data?.items ?? emptyReports;
  const items = sourceItems.filter(item => !isMarkedUsfaTestRecord(item));
  const excludedTestRecords = (data?.excludedTestRecords ?? 0) + sourceItems.length - items.length;
  const page = tvMode ? fatalityPage(items, height, pageIndex) : { items, start: 0, pages: 1 };
  useEffect(() => {
    if (!tvMode || !active || page.pages < 2) return;
    // Advance only while this panel is visible. Keep the page across board
    // rotations so shorter/custom slide schedules cannot skip recent reports.
    const timer = window.setInterval(() => setPageIndex(index => index + 1), 6000);
    return () => window.clearInterval(timer);
  }, [tvMode, active, page.pages]);

  if (!data) return <p className="board-empty">USFA fatality information is temporarily unavailable.</p>;
  const first = page.start + 1, last = page.start + page.items.length;
  const range = first === last ? String(first) : `${first}–${last}`;
  return <div className="fatality-board">
    <div className="fatality-total"><strong>{data.total}</strong><div><b>USFA-reported deaths in {data.year}</b><span>{updatedLabel}</span></div></div>
    <div ref={list} className="fatality-list" style={tvMode ? { gridTemplateRows: `repeat(${Math.max(1, page.items.length)},minmax(0,1fr))` } as CSSProperties : undefined}>
      {page.items.map(person => {
        const name = sourceText(person.name, 'Name not provided by USFA');
        const department = sourceText(person.department, 'Department not provided by USFA');
        const location = sourceText(person.location, 'Location not provided by USFA');
        const date = new Date(person.deathDate);
        return <a href={person.url} target="_blank" rel="noopener noreferrer" key={person.id} aria-label={`${name}, ${department}, ${location}. Open USFA report.`}>
          <time dateTime={Number.isFinite(date.getTime()) ? person.deathDate : undefined}>{Number.isFinite(date.getTime()) ? date.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' }) : 'Date unavailable'}</time>
          <div><strong>{name}</strong><span>{department}</span><small>{location}</small></div><b aria-hidden="true">↗</b>
        </a>;
      })}
      {!items.length && <p className="fatality-details-unavailable">Recent names and departments are not available in this saved update. <a href="https://apps.usfa.fema.gov/firefighter-fatalities/" target="_blank" rel="noopener noreferrer">Open USFA reports ↗</a></p>}
    </div>
    <p className="fatality-pages">{items.length ? `Recent reports ${range} of ${items.length}${tvMode && page.pages > 1 ? ' · More reports rotate automatically' : ''}` : 'Recent report details unavailable'}</p>
    <p className="fatality-source">{excludedTestRecords ? 'Marked test entries excluded from recent reports. Annual total as reported by USFA.' : 'Provisional on-duty fatality information from the U.S. Fire Administration.'}</p>
  </div>;
}
