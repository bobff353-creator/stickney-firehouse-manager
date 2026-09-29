"use client";

import { useMemo } from "react";
import { useWorkspaceViewState } from "./workspace-view-state";
import { scheduleDateOffset, staffingWeek, type CoverageSlot } from "./scheduler-overview";

const dateLabel = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

export function SchedulerCoverage({ today, entries, slots, onDay, onBuild }: {
  today: string; entries: { id: string; entryDate: string }[]; slots: CoverageSlot[];
  onDay: (date: string) => void; onBuild: () => void;
}) {
  const [from, setFrom] = useWorkspaceViewState("scheduler-coverage-from", today);
  const days = useMemo(() => staffingWeek(entries, slots, from), [entries, slots, from]);
  return <section className="scheduler-coverage" aria-labelledby="staffing-week-title">
    <div className="entry-head"><div><h3 id="staffing-week-title">Staffing at a glance</h3><p>{dateLabel(from)} – {dateLabel(days[6].date)} · Central time</p></div>
      <div className="row-actions"><button type="button" aria-label="Previous staffing week" onClick={() => setFrom(scheduleDateOffset(from, -7))}>← Previous</button><button type="button" onClick={() => setFrom(today)}>This week</button><button type="button" aria-label="Next staffing week" onClick={() => setFrom(scheduleDateOffset(from, 7))}>Next →</button></div>
    </div>
    <p className="muted">Filled seats in the loaded schedule. Select a day to review each shift and make changes.</p>
    <div className="scheduler-coverage-days">{days.map(day => <button type="button" key={day.date} className={day.open ? "has-open" : ""} onClick={() => onDay(day.date)} aria-label={`${dateLabel(day.date)}: ${day.shifts ? `${day.filled} of ${day.required} required seats filled, ${day.open} required seats open, ${day.extraOpen} extra seats open` : "No shifts loaded"}. Open day staffing`}>
      <strong>{dateLabel(day.date)}</strong>
      {day.shifts ? <><span className="scheduler-coverage-count">{day.filled}<small> / {day.required}</small></span><span>required seats filled</span><b>{day.open ? `${day.open} required open` : day.required ? "Loaded seats filled" : "No required seats set"}</b>{(day.extraFilled > 0 || day.extraOpen > 0) && <span>Extra: {day.extraFilled} filled · {day.extraOpen} open</span>}</> : <><span className="scheduler-coverage-count">—</span><span>No shifts loaded</span><b>Review this day</b></>}
      <span className="scheduler-card-next">Open day →</span>
    </button>)}</div>
    {days.some(day => !day.shifts || !day.required) && <p className="scheduler-coverage-note">Missing a shift or required position? <button type="button" className="link" onClick={onBuild}>Open Shift Builder</button></p>}
  </section>;
}
