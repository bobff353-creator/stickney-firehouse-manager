import { scheduleSetupSummary } from './schedule-setup-model';
import './schedule-setup.css';

type SummaryData = Parameters<typeof scheduleSetupSummary>[0];
export function ScheduleSetup({ data, month, onMonth, onOpen }: {
  data: SummaryData; month: string; onMonth: (month: string) => void; onOpen: (screen: string) => void;
}) {
  const summary = scheduleSetupSummary(data, month);
  const dateLabel = (date: string) => new Date(date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return <section className="schedule-setup" aria-labelledby="schedule-setup-title">
    <header><span className="section-kicker">Start here</span><h3 id="schedule-setup-title">Set up a month</h3><p>Keep the regular crews. Check who asked to work, fill open positions, then review the month.</p>
      <label><span>Schedule month</span><input type="month" value={month} onChange={e => onMonth(e.target.value)} /></label>
    </header>
    {!summary.range ? <p role="alert">Choose a valid month to continue.</p> : <>
      <p className="schedule-setup-boundary">Viewing {dateLabel(summary.range.from)} through {dateLabel(summary.range.through)} · Central time. Choosing a month does not change any assignments.</p>
      <div className="schedule-setup-counts" aria-label="Saved month totals"><span>Filled positions: <b>{summary.filled}</b></span><span>Open positions: <b>{summary.open}</b></span><span>Members with availability entries: <b>{summary.submitted}</b></span></div>
      {!summary.positions && <p role="status">No built positions are loaded for this month. Check the shift patterns before trying to fill it.</p>}
      <ol className="schedule-setup-steps">
        <li><div><h4>1. Keep recurring crews</h4><p>{summary.recurring} saved standing assignments. They stay in place when you fill open positions.</p></div><button type="button" onClick={() => onOpen('roster')}>Review recurring crews</button></li>
        <li><div><h4>2. Check shift times and positions</h4><p>{summary.shifts} active shift patterns. Existing patterns do not need to be rebuilt each month.</p></div><button type="button" onClick={() => onOpen('shiftTypes')}>Review shift patterns</button></li>
        <li><div><h4>3. Check submitted availability</h4><p>{summary.blank} members have no entry in this month. Blank time is not permission to work. The full shift must fit their entered hours.</p></div><button type="button" onClick={() => onOpen('availability')}>Review availability</button></li>
        <li><div><h4>4. Fill open positions</h4><p>Review the dates before saving. Use submitted availability and all existing qualification, time-off, conflict and priority rules. Filled positions stay unchanged.</p></div><button type="button" disabled={!summary.open} onClick={() => onOpen('distribution')}>Review and fill {summary.open} {summary.open === 1 ? 'open position' : 'open positions'}</button></li>
        <li><div><h4>5. Review the saved month</h4><p>Check the crew, times and remaining openings. An open position stays open when nobody qualifies for that time.</p></div><div className="schedule-setup-actions"><button type="button" onClick={() => onOpen('calendar')}>Open month calendar</button><button type="button" onClick={() => onOpen('safety')}>Review conflicts and rules</button></div></li>
      </ol>
    </>}
    <p className="schedule-setup-note">Setup does not turn on automatic texts or emails. Existing records, requests and scheduling tools remain available.</p>
  </section>;
}
