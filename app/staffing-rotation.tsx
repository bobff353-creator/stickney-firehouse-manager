"use client";
/* eslint-disable @next/next/no-img-element -- employee photos are served from the portal's authenticated R2 route. */

import { useEffect, useMemo, useState } from "react";
import { formatEmployeeName } from "./employee-names";

export type StaffingPerson = { employeeId: string; name: string; rank: string; timeIn: string; timeOut: string; actingOfficer: number };
export type NewMember = { id: string; name: string; rank: string; employeeNumber: string | null; startDate: string; photoUpdatedAt: string | null };
type ScheduleItem = { memberId: number; name: string; schedule: string; position: string; timeType: string; start: string; stop: string };
type SchedulePayload = {
  connected: boolean;
  status: "live" | "setup_required" | "unavailable";
  message?: string;
  externalUrl: string;
  asOf?: string;
  items: ScheduleItem[];
};
type View = { type: "current" } | { type: "aladtec" } | { type: "new-member"; member: NewMember };

const aladtecUrl = "https://secure11.aladtec.com/stickneyfire/index.php?action=manage_schedule_view_schedule&schedule_view=daily_blocks";

function initials(name: string) {
  return formatEmployeeName(name).split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "FD";
}

function timeRange(start: string, stop: string) {
  const options = { timeZone: "America/Chicago", hour: "numeric", minute: "2-digit" } as const;
  const startDate = new Date(start), stopDate = new Date(stop);
  const day = startDate.toLocaleDateString("en-US", { timeZone: "America/Chicago", weekday: "short" });
  return `${day} ${startDate.toLocaleTimeString("en-US", options)} – ${stopDate.toLocaleTimeString("en-US", options)}`;
}

function joinedLabel(startDate: string) {
  const start = new Date(`${startDate}T12:00:00`);
  const days = Math.max(0, Math.floor((Date.now() - start.getTime()) / 86400000));
  return days === 0 ? "Started today" : `Joined ${days} day${days === 1 ? "" : "s"} ago`;
}

export default function StaffingRotation({
  onDuty,
  newMembers,
  mode,
  onOpenDailyLog,
}: {
  onDuty: StaffingPerson[];
  newMembers: NewMember[];
  mode: "dashboard" | "board";
  onOpenDailyLog?: () => void;
}) {
  const [schedule, setSchedule] = useState<SchedulePayload | null>(null);
  const [viewIndex, setViewIndex] = useState(0);
  const views = useMemo<View[]>(() => [{ type: "current" }, { type: "aladtec" }, ...newMembers.map((member) => ({ type: "new-member" as const, member }))], [newMembers]);
  const activeIndex = viewIndex % views.length;
  const current = views[activeIndex] ?? views[0];

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch("/api/aladtec-schedule");
        const payload = await response.json() as SchedulePayload;
        setSchedule(payload);
      } catch {
        setSchedule({ connected: false, status: "unavailable", message: "Aladtec schedule is temporarily unavailable", externalUrl: aladtecUrl, items: [] });
      }
    };
    const initial = window.setTimeout(() => void load(), 0);
    const refresh = window.setInterval(() => void load(), 5 * 60 * 1000);
    return () => { window.clearTimeout(initial); window.clearInterval(refresh); };
  }, []);

  useEffect(() => {
    if (views.length < 2) return;
    const timer = window.setInterval(() => setViewIndex((index) => (index + 1) % views.length), 10000);
    return () => window.clearInterval(timer);
  }, [views.length]);

  const title = current.type === "current"
    ? "Current staffing"
    : current.type === "aladtec"
      ? "Next 24 hours"
      : "New member";
  const subtitle = current.type === "current"
    ? `${onDuty.length} member${onDuty.length === 1 ? "" : "s"} on duty`
    : current.type === "aladtec"
      ? schedule?.connected ? `Aladtec · ${schedule.items.length} assignment${schedule.items.length === 1 ? "" : "s"}` : "Aladtec connection"
      : current.member.startDate;

  const content = current.type === "current"
    ? <div className="staffing-current-list">{onDuty.length ? onDuty.map((person) => <div key={person.employeeId}><span>{formatEmployeeName(person.name)}{person.actingOfficer ? <b>AO</b> : null}</span><small>{person.rank} · {person.timeIn}–{person.timeOut}</small></div>) : <p>No current staffing has been entered.</p>}</div>
    : current.type === "aladtec"
      ? schedule?.connected
        ? <div className="schedule-24-list">{schedule.items.length ? schedule.items.map((item, index) => <div key={`${item.memberId}-${item.start}-${item.position}-${index}`}><time>{timeRange(item.start, item.stop)}</time><strong>{formatEmployeeName(item.name)}</strong><small>{item.schedule} · {item.position}{item.timeType ? ` · ${item.timeType}` : ""}</small></div>) : <p>No Aladtec assignments are scheduled in the next 24 hours.</p>}</div>
        : <div className="aladtec-connection-state"><strong>{schedule?.message || "Checking the Aladtec connection…"}</strong><p>The portal will show the verified 24-hour schedule here after the Aladtec API profile is connected.</p></div>
      : <div className="new-member-spotlight"><div className="new-member-photo">{current.member.photoUpdatedAt ? <img src={`/api/employee-photo/${current.member.id}?v=${encodeURIComponent(current.member.photoUpdatedAt)}`} alt={`${formatEmployeeName(current.member.name)} employee photo`} /> : <span>{initials(current.member.name)}</span>}</div><div><span>Welcome to Stickney Fire Department</span><strong>{formatEmployeeName(current.member.name)}</strong><p>{current.member.rank}</p><dl><div><dt>Employee ID</dt><dd>{current.member.employeeNumber || "Not entered"}</dd></div><div><dt>Start date</dt><dd>{new Date(`${current.member.startDate}T12:00:00`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</dd></div></dl><small>{joinedLabel(current.member.startDate)}</small></div></div>;

  const controls = <div className="staffing-rotation-controls" aria-label="Staffing panel pages">{views.map((view, index) => <button key={view.type === "new-member" ? view.member.id : view.type} className={index === activeIndex ? "active" : ""} aria-label={`Show ${view.type === "current" ? "current staffing" : view.type === "aladtec" ? "Aladtec next 24 hours" : `${formatEmployeeName(view.member.name)} new member spotlight`}`} onClick={() => setViewIndex(index)} />)}<span>Rotates every 10 seconds</span></div>;

  if (mode === "board") {
    return <section className={`board-panel staffing staffing-rotation-panel ${current.type}`} aria-live="polite"><header><h2>{title}</h2><span>{subtitle}</span></header><div className="staffing-rotation-body">{content}</div><footer>{controls}{current.type === "aladtec" && <a href={schedule?.externalUrl || aladtecUrl} target="_blank" rel="noreferrer">Open Aladtec ↗</a>}</footer></section>;
  }

  return <article className={`command-card on-duty staffing-rotation-card ${current.type}`} aria-live="polite"><header><span className="command-icon">{current.type === "current" ? "●" : current.type === "aladtec" ? "◷" : "+"}</span><div><small>{title}</small><h2>{subtitle}</h2></div></header><div className="staffing-rotation-body">{content}</div><footer>{controls}{current.type === "current" && onOpenDailyLog ? <button onClick={onOpenDailyLog}>Open Daily Log →</button> : current.type === "aladtec" ? <a href={schedule?.externalUrl || aladtecUrl} target="_blank" rel="noreferrer">Open Aladtec Schedule ↗</a> : null}</footer></article>;
}
