"use client";
import { useState } from "react";
import { serviceDateLabel, serviceDates, serviceToday } from "./inventory-service-schedule";

const intervals = [["12", "Yearly · 12 months"], ["18", "Every 18 months"], ["24", "Every 2 years"], ["36", "Every 3 years"], ["60", "Every 5 years"]];
const leads = [["0", "On the due date"], ["1", "1 month before"], ["2", "2 months before"], ["3", "3 months before"], ["4", "4 months before"], ["6", "6 months before"]];

export function ServiceScheduleFields({ item }: { item: Record<string, unknown> }) {
  const initialInterval = String(item.service_interval_months ?? "");
  const initialLead = String(item.service_reminder_months ?? 3);
  const [intervalChoice, setIntervalChoice] = useState(!initialInterval ? "" : intervals.some(([id]) => id === initialInterval) ? initialInterval : "custom");
  const [customInterval, setCustomInterval] = useState(initialInterval);
  const [leadChoice, setLeadChoice] = useState(leads.some(([id]) => id === initialLead) ? initialLead : "custom");
  const [customLead, setCustomLead] = useState(initialLead);
  const [last, setLast] = useState(String(item.last_serviced_date ?? ""));
  const enabled = Boolean(intervalChoice);
  const interval = intervalChoice === "custom" ? customInterval : intervalChoice;
  const lead = leadChoice === "custom" ? customLead : leadChoice;
  const today = serviceToday();
  let preview = null, error = "";
  try { if (enabled && interval) preview = serviceDates({ last_serviced_date: last, service_interval_months: interval, service_reminder_months: lead }, today); }
  catch (caught) { error = caught instanceof Error ? caught.message : "Review the service schedule."; }
  return <fieldset className="service-schedule-fields"><legend>Service schedule & reminder</legend>
    <p>Choose the interval required for this item. After completed service, update Last serviced and save to start its next cycle. This does not change hydro-test dates or mark equipment safe to use.</p>
    <div className="service-schedule-grid">
      <label>Last serviced<input type="date" name="last_serviced_date" value={last} min="1900-01-01" max={today} required={enabled} onChange={event => setLast(event.target.value)} /></label>
      <label>Service every<select aria-label="Service every" value={intervalChoice} onChange={event => setIntervalChoice(event.target.value)}><option value="">No recurring service reminder</option>{intervals.map(([id, label]) => <option key={id} value={id}>{label}</option>)}<option value="custom">Custom months…</option></select></label>
      {intervalChoice === "custom" ? <label>Service interval in months<input type="number" min={1} max={600} step={1} required value={customInterval} onChange={event => setCustomInterval(event.target.value)} /></label> : null}
      {enabled ? <label>Show reminder in Due Now<select aria-label="Show reminder in Due Now" value={leadChoice} onChange={event => setLeadChoice(event.target.value)}>{leads.map(([id, label]) => <option key={id} value={id}>{label}</option>)}<option value="custom">Custom months before…</option></select></label> : null}
      {enabled && leadChoice === "custom" ? <label>Reminder months before<input type="number" min={0} max={Math.min(120, Number(interval) - 1)} step={1} required value={customLead} onChange={event => setCustomLead(event.target.value)} /></label> : null}
    </div>
    <input type="hidden" name="service_interval_months" value={interval} /><input type="hidden" name="service_reminder_months" value={enabled ? lead : ""} />
    <div className="service-schedule-preview" aria-live="polite">{preview ? <><strong>Next service: {serviceDateLabel(preview.due)}</strong><span>Reminder starts: {serviceDateLabel(preview.reminder)}</span><small>{preview.status === "overdue" ? "Already overdue — it will appear in Due Now after saving." : preview.status !== "upcoming" ? "It will appear in Due Now after saving." : "It will appear in Due Now on the reminder date."} In-app reminder only; no email is sent.</small></> : <span>{error || (enabled ? "Enter the service interval to calculate the dates." : "No automatic service reminder. You can still record the last service date.")}</span>}</div>
  </fieldset>;
}

export function ServiceScheduleSummary({ item }: { item: Record<string, unknown> }) {
  let dates;
  try { dates = serviceDates(item); } catch { return <p className="service-schedule-preview" role="status">Service schedule needs review. Open the asset editor to correct its dates and interval.</p>; }
  return <div className="service-schedule-summary"><strong>Service schedule</strong><span>Last serviced: {serviceDateLabel(String(item.last_serviced_date || "") || null)}</span>{dates ? <><span>Every {String(item.service_interval_months)} months · Reminder {String(item.service_reminder_months)} months before</span><span>Next service: {serviceDateLabel(dates.due)}{dates.status === "overdue" ? " · Overdue" : dates.status === "due" ? " · Due today" : ""}</span><span>Reminder starts: {serviceDateLabel(dates.reminder)}</span></> : <span>No recurring service reminder set.</span>}</div>;
}
