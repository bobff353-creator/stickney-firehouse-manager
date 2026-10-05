"use client";
import { useState } from 'react';
import { timekeepingReviewCsv, type TimekeepingFlag } from './payroll-timekeeping-review';
import './schedule-safety.css';
export function PayrollTimekeepingPanel({ flags, from, through, onMember }: { flags: TimekeepingFlag[]; from: string; through: string; onMember: (id: string) => void }) {
  const [filter, setFilter] = useState('');
  const visible = flags.filter(flag => `${flag.employeeName} ${flag.date} ${flag.message}`.toLowerCase().includes(filter.toLowerCase()));
  function download() {
    const url = URL.createObjectURL(new Blob([timekeepingReviewCsv(flags, from, through)], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `Timekeeping-Review-${from}-to-${through}.csv`; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <section className="schedule-safety" aria-label="Timekeeping review">
    <header><div><h2>Timekeeping review</h2><p>{flags.length} review {flags.length === 1 ? 'flag' : 'flags'} in saved attendance and duty-pay records. Schedule estimates, callbacks and pay premiums are reviewed in their existing workflows.</p></div><button type="button" onClick={download}>Download review CSV</button></header>
    <label>Find a timekeeping flag<input type="search" value={filter} onChange={event => setFilter(event.target.value)} placeholder="Employee, date or issue" /></label>
    <ul>{visible.slice(0, 50).map((flag, index) => <li key={`${flag.employeeId}:${flag.date}:${index}`}><div><strong>{flag.employeeName}</strong><span>{flag.message}</span></div><button type="button" onClick={() => onMember(flag.employeeId)}>Review timesheet →</button></li>)}</ul>
    {!visible.length && <p role="status">No matching timekeeping flags. This is a record comparison, not payroll approval.</p>}
    {visible.length > 50 && <p>{visible.length - 50} more flags. Narrow the search or download the complete review.</p>}
    <p>Verify differences against the Daily Log and approved corrections. This screen does not change hours, rates or a submitted copy.</p>
  </section>;
}
