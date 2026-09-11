"use client";
/* eslint-disable @next/next/no-img-element -- employee photos are served from the portal's authenticated R2 route. */

import { useEffect, useMemo, useState } from "react";
import { formatEmployeeName } from "./employee-names";
import { joinedLabel } from "./member-start-label";
import type { DepartmentScheduleShift, DepartmentScheduleWindowItem } from "./department-schedule";

export type StaffingPerson = { employeeId: string; name: string; rank: string; timeIn: string; timeOut: string; actingOfficer: number };
export type NewMember = { id: string; name: string; rank: string; employeeNumber: string | null; startDate: string; photoUpdatedAt: string | null };
type ScheduleItem = DepartmentScheduleWindowItem;
type SchedulePayload = {
  source?: "department_schedule";
  asOf?: string;
  error?: string;
  items: ScheduleItem[];
  upcomingShifts?: DepartmentScheduleShift[];
};
type View = { type: "current" } | { type: "schedule"; shift?: DepartmentScheduleShift; slot?: number; page?: number } | { type: "new-member"; member: NewMember };

function initials(name: string) {
  return formatEmployeeName(name).split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "FD";
}

function clockLabel(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return `${hours % 12 || 12}:${String(minutes).padStart(2, "0")} ${hours < 12 ? "AM" : "PM"}`;
}

function dayLabel(value: string) {
  return new Date(`${value}T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", weekday: "short" });
}

function timeRange(item: Pick<ScheduleItem, "workDate" | "startTime" | "endDate" | "endTime">) {
  const start = `${dayLabel(item.workDate)} ${clockLabel(item.startTime)}`;
  const endDay = item.endDate === item.workDate ? "" : `${dayLabel(item.endDate)} `;
  return `${start} – ${endDay}${clockLabel(item.endTime)}`;
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
  const views = useMemo<View[]>(() => {
    const staffingViews: View[] = mode === "board"
      ? schedule?.upcomingShifts?.length ? schedule.upcomingShifts.flatMap((shift, slot) => Array.from({ length: Math.max(1, Math.ceil(shift.items.length / 6)) }, (_, page) => ({ type: "schedule" as const, shift, slot, page }))) : [{ type: "schedule" }]
      : [{ type: "current" }, { type: "schedule" }];
    return [...staffingViews, ...newMembers.map((member) => ({ type: "new-member" as const, member }))];
  }, [mode, schedule, newMembers]);
  const activeIndex = viewIndex % views.length;
  const current = views[activeIndex] ?? views[0];

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch("/api/department-schedule");
        const payload = await response.json() as SchedulePayload;
        setSchedule(response.ok ? payload : { error: payload.error || "The department schedule is temporarily unavailable.", items: [] });
      } catch {
        setSchedule({ error: "The department schedule is temporarily unavailable.", items: [] });
      }
    };
    const initial = window.setTimeout(() => void load(), 0);
    const refresh = window.setInterval(() => void load(), 60 * 1000);
    return () => { window.clearTimeout(initial); window.clearInterval(refresh); };
  }, []);

  useEffect(() => {
    if (views.length < 2) return;
    const timer = window.setInterval(() => setViewIndex((index) => (index + 1) % views.length), 10000);
    return () => window.clearInterval(timer);
  }, [views.length]);

  const title = current.type === "current"
    ? "Current staffing"
    : current.type === "schedule"
      ? current.shift ? `Upcoming crew · ${(current.slot ?? 0) + 1} of 3` : mode === "board" ? "Upcoming crews" : "Next 24 hours"
      : "New member";
  const subtitle = current.type === "current"
    ? `${onDuty.length} member${onDuty.length === 1 ? "" : "s"} on duty`
    : current.type === "schedule"
      ? current.shift ? `${new Date(`${current.shift.workDate}T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric" })} · ${timeRange(current.shift)}` : `Department schedule · ${schedule?.items.length ?? 0} assignment${schedule?.items.length === 1 ? "" : "s"}`
      : current.member.startDate;
  const boardScheduleItems = current.type === "schedule" && current.shift ? current.shift.items.slice((current.page ?? 0) * 6, ((current.page ?? 0) + 1) * 6) : mode === "board" ? [] : schedule?.items ?? [];
  const pageCount = current.type === "schedule" && current.shift ? Math.ceil(current.shift.items.length / 6) : 0;

  const content = current.type === "current"
    ? <div className="staffing-current-list">{onDuty.length ? onDuty.map((person) => <div key={person.employeeId}><span>{formatEmployeeName(person.name)}{person.actingOfficer ? <b>AO</b> : null}</span><small>{person.rank} · {person.timeIn}–{person.timeOut}</small></div>) : <p>No current staffing has been entered.</p>}</div>
    : current.type === "schedule"
      ? schedule?.error
        ? <div className="aladtec-connection-state"><strong>{schedule.error}</strong><p>Assignments will reappear automatically when the department schedule is available.</p></div>
        : <div className="schedule-24-list">{boardScheduleItems.length ? <>{boardScheduleItems.map((item) => <div key={item.id}><time>{timeRange(item)}</time><strong>{formatEmployeeName(item.employeeName ?? "Name unavailable")}</strong><small>{item.role}</small></div>)}{pageCount > 1 ? <p className="schedule-24-overflow">Crew page {(current.page ?? 0) + 1} of {pageCount} · remaining members rotate automatically</p> : null}</> : <p>{!schedule ? "Loading department schedule…" : current.shift ? "No members assigned to this time slot." : mode === "board" ? "Upcoming time slots are unavailable." : "No department assignments overlap the next 24 hours."}</p>}</div>
      : <div className="new-member-spotlight"><div className="new-member-photo">{current.member.photoUpdatedAt ? <img src={`/api/employee-photo/${current.member.id}?v=${encodeURIComponent(current.member.photoUpdatedAt)}`} alt={`${formatEmployeeName(current.member.name)} employee photo`} /> : <span>{initials(current.member.name)}</span>}</div><div><span>Welcome to Stickney Fire Department</span><strong>{formatEmployeeName(current.member.name)}</strong><p>{current.member.rank}</p><dl><div><dt>Employee ID</dt><dd>{current.member.employeeNumber || "Not entered"}</dd></div><div><dt>Start date</dt><dd>{new Date(`${current.member.startDate}T12:00:00`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</dd></div></dl><small>{joinedLabel(current.member.startDate)}</small></div></div>;

  if (mode === "board") {
    return <section className={`board-panel staffing staffing-rotation-panel ${current.type}`} aria-live="polite"><header><h2>{title}</h2><span>{subtitle}</span></header><div className="staffing-rotation-body">{content}</div></section>;
  }

  return <article className={`command-card on-duty staffing-rotation-card ${current.type}`} aria-live="polite"><header><span className="command-icon">{current.type === "current" ? "●" : current.type === "schedule" ? "◷" : "+"}</span><div><small>{title}</small><h2>{subtitle}</h2></div></header><div className="staffing-rotation-body">{content}</div>{current.type === "current" && onOpenDailyLog ? <footer><button onClick={onOpenDailyLog}>Open Daily Log →</button></footer> : null}</article>;
}
