"use client";
import { useCallback, useEffect, useMemo, useState } from "react";

type Daily = { date: string; staffingGaps: number; overtimeHours: number; aoHours: number; calls: number; equipmentIssues: number; payrollCost: number };
type Data = {
  daily: Daily[];
  responseTypeDaily: Array<{ date: string; callType: string; count: number }>;
  callTiming: Array<{ date: string; timeOut: string }>;
  fiscalYear: { startDate: string; endDate: string; payToDate: number };
  generatedAt: string;
  error?: string;
};
type Metric = Exclude<keyof Daily, "date">;
const metricInfo: Array<{ key: Metric; label: string; color: string; unit?: string }> = [
  { key: "staffingGaps", label: "Staffing gaps", color: "#c34a42" },
  { key: "overtimeHours", label: "Overtime hours", color: "#a86a10", unit: "hr" },
  { key: "aoHours", label: "Acting Officer hours", color: "#654e91", unit: "hr" },
  { key: "calls", label: "Call volume", color: "#216c91" },
  { key: "equipmentIssues", label: "Equipment issues", color: "#9a5b2b" },
  { key: "payrollCost", label: "Payroll cost", color: "#27704a", unit: "$" },
];
const weekdayOrder = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const timeBlocks = [
  { label: "Overnight", detail: "0000–0559", start: 0, end: 6 },
  { label: "Morning", detail: "0600–1159", start: 6, end: 12 },
  { label: "Afternoon", detail: "1200–1759", start: 12, end: 18 },
  { label: "Evening", detail: "1800–2359", start: 18, end: 24 },
];

function bucketKey(date: string, mode: "weekly" | "monthly") {
  if (mode === "monthly") return date.slice(0, 7);
  const value = new Date(`${date}T12:00:00Z`), day = value.getUTCDay() || 7;
  value.setUTCDate(value.getUTCDate() - day + 1);
  return value.toISOString().slice(0, 10);
}
function bucketLabel(key: string, mode: "weekly" | "monthly") {
  const date = new Date(`${mode === "monthly" ? `${key}-01` : key}T12:00:00Z`);
  return mode === "monthly" ? date.toLocaleDateString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" }) : date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}
const format = (key: Metric, value: number) => key === "payrollCost" ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value) : value.toLocaleString("en-US", { maximumFractionDigits: 1 });
const money = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
const shortDate = (value: string) => new Date(`${value}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
function callHour(value: string) {
  const digits = value.replace(/\D/g, "").padStart(4, "0").slice(-4), hour = Number(digits.slice(0, 2)), minute = Number(digits.slice(2));
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59 ? hour : null;
}
function Trend({ values, color, labels }: { values: number[]; color: string; labels: string[] }) {
  const max = Math.max(1, ...values), points = values.map((value, index) => `${values.length === 1 ? 50 : (index / (values.length - 1)) * 100},${42 - (value / max) * 36}`).join(" ");
  return <div className="trend-chart"><svg viewBox="0 0 100 48" preserveAspectRatio="none" role="img" aria-label={`Trend from ${labels[0] || "start"} to ${labels.at(-1) || "current"}`}><line x1="0" y1="42" x2="100" y2="42"/><polyline points={points} style={{ stroke: color }}/>{values.map((value, index) => <circle key={index} cx={values.length === 1 ? 50 : (index / (values.length - 1)) * 100} cy={42 - (value / max) * 36} r="1.4" style={{ fill: color }}/>)}</svg><div><span>{labels[0]}</span><span>{labels.at(-1)}</span></div></div>;
}

export default function CommandCenter() {
  const [data, setData] = useState<Data | null>(null);
  const [mode, setMode] = useState<"weekly" | "monthly">("weekly");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [callBreakdownOpen, setCallBreakdownOpen] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    const response = await fetch("/api/command-center");
    const result = await response.json() as Data;
    if (response.ok) { setData(result); setError(""); } else setError(result.error || "Unable to load trends");
    setLoading(false);
  }, []);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);
  const buckets = useMemo(() => {
    const map = new Map<string, Daily>();
    for (const row of data?.daily ?? []) {
      const key = bucketKey(row.date, mode);
      if (!map.has(key)) map.set(key, { date: key, staffingGaps: 0, overtimeHours: 0, aoHours: 0, calls: 0, equipmentIssues: 0, payrollCost: 0 });
      const bucket = map.get(key)!;
      for (const metric of metricInfo) bucket[metric.key] += row[metric.key];
    }
    return [...map.values()].sort((a, b) => a.date.localeCompare(b.date)).slice(-12);
  }, [data, mode]);
  const responseTypes = useMemo(() => {
    const cutoff = new Date(); cutoff.setUTCDate(cutoff.getUTCDate() - (mode === "weekly" ? 84 : 365));
    const totals = new Map<string, number>();
    for (const row of data?.responseTypeDaily ?? []) if (new Date(`${row.date}T12:00:00Z`) >= cutoff) totals.set(row.callType, (totals.get(row.callType) || 0) + row.count);
    return [...totals.entries()].sort((a, b) => b[1] - a[1]);
  }, [data, mode]);
  const callBreakdown = useMemo(() => {
    const cutoff = new Date(); cutoff.setUTCDate(cutoff.getUTCDate() - (mode === "weekly" ? 84 : 365));
    const rows = (data?.callTiming ?? []).filter((row) => new Date(`${row.date}T12:00:00Z`) >= cutoff);
    const weekdays = new Map(weekdayOrder.map((day) => [day, 0]));
    const times = new Map(timeBlocks.map((block) => [block.label, 0]));
    let missingTime = 0;
    for (const row of rows) {
      const day = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][new Date(`${row.date}T12:00:00Z`).getUTCDay()];
      weekdays.set(day, (weekdays.get(day) || 0) + 1);
      const hour = callHour(row.timeOut || "");
      if (hour === null) { missingTime += 1; continue; }
      const block = timeBlocks.find((item) => hour >= item.start && hour < item.end)!;
      times.set(block.label, (times.get(block.label) || 0) + 1);
    }
    return { total: rows.length, weekdays: [...weekdays.entries()], times: timeBlocks.map((block) => ({ ...block, count: times.get(block.label) || 0 })), missingTime };
  }, [data, mode]);
  const labels = buckets.map((bucket) => bucketLabel(bucket.date, mode));

  return <section className="command-center-page">
    <header className="standard-page-header command-center-header"><div><span className="page-icon">⌁</span><div><p className="eyebrow">Administrator analytics</p><h1>Department Command Center</h1><p>Operational readiness, activity, and payroll trends from official department records.</p></div></div><div className="trend-toggle"><button className={mode === "weekly" ? "active" : ""} onClick={() => setMode("weekly")}>Weekly</button><button className={mode === "monthly" ? "active" : ""} onClick={() => setMode("monthly")}>Monthly</button></div></header>
    {error && <div className="error-banner"><span>{error}</span><button onClick={() => void load()}>Retry</button></div>}
    {loading ? <div className="command-center-loading">{metricInfo.map((item) => <i key={item.key}/>)}</div> : <>
      <section className="fiscal-pay-card"><div><span>Fiscal year pay to date</span><strong>{money(data?.fiscalYear.payToDate || 0)}</strong><small>Calculated department gross pay recorded from {data?.fiscalYear ? shortDate(data.fiscalYear.startDate) : "May 1"} through today</small></div><b>FY {data?.fiscalYear ? `${data.fiscalYear.startDate.slice(0, 4)}–${data.fiscalYear.endDate.slice(2, 4)}` : "—"}</b></section>
      <div className="trend-card-grid">{metricInfo.map((item) => {
        const values = buckets.map((bucket) => bucket[item.key]), total = values.reduce((sum, value) => sum + value, 0), previous = values.at(-2) || 0, current = values.at(-1) || 0, change = previous ? ((current - previous) / previous) * 100 : current ? 100 : 0;
        const contents = <><header><span>{item.label}</span><b style={{ background: item.color }}/></header><strong>{format(item.key, total)}{item.unit === "hr" ? <small> hr</small> : null}</strong><p>{item.key === "calls" ? "Click for busiest days and times" : mode === "weekly" ? "Last 12 weeks" : "Last 12 months"}<em className={change > 0 ? "up" : change < 0 ? "down" : "flat"}>{change > 0 ? "↑" : change < 0 ? "↓" : "–"} {Math.abs(change).toFixed(0)}%</em></p><Trend values={values} color={item.color} labels={labels}/></>;
        return item.key === "calls" ? <button type="button" className="trend-card trend-card-button" key={item.key} onClick={() => setCallBreakdownOpen(true)} aria-haspopup="dialog">{contents}<span className="open-breakdown">Open call breakdown →</span></button> : <article className="trend-card" key={item.key}>{contents}</article>;
      })}</div>
      <div className="command-center-lower"><section className="content-card response-type-panel"><div className="section-header"><div><h2>Response types</h2><p>{mode === "weekly" ? "Last 12 weeks" : "Last 12 months"}</p></div><span className="count-badge">{responseTypes.reduce((sum, [, count]) => sum + count, 0)} calls</span></div><div className="response-bars">{responseTypes.length ? responseTypes.map(([type, count]) => { const max = Math.max(...responseTypes.map(([, value]) => value)); return <div key={type}><span>{type}</span><i><b style={{ width: `${(count / max) * 100}%` }}/></i><strong>{count}</strong></div>; }) : <p>No calls recorded in this range.</p>}</div></section><section className="content-card command-insight"><h2>Command summary</h2>{metricInfo.map((item) => <div key={item.key}><span>{item.label}</span><strong>{format(item.key, buckets.at(-1)?.[item.key] || 0)}</strong><small>Current {mode === "weekly" ? "week" : "month"}</small></div>)}<p>Updated {data?.generatedAt ? new Date(data.generatedAt).toLocaleString() : "—"}</p></section></div>
    </>}
    {callBreakdownOpen && <div className="call-breakdown-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) setCallBreakdownOpen(false); }}><section className="call-breakdown-dialog" role="dialog" aria-modal="true" aria-labelledby="call-breakdown-title"><header><div><p className="eyebrow">Call volume detail</p><h2 id="call-breakdown-title">When calls happen most</h2><p>{mode === "weekly" ? "Last 12 weeks" : "Last 12 months"} · {callBreakdown.total} calls</p></div><button type="button" autoFocus aria-label="Close call breakdown" onClick={() => setCallBreakdownOpen(false)}>×</button></header><div className="call-breakdown-grid"><section><h3>Day of week</h3><div className="breakdown-bars">{callBreakdown.weekdays.map(([label, count]) => { const max = Math.max(1, ...callBreakdown.weekdays.map(([, value]) => value)); return <div key={label}><span>{label}</span><i><b style={{ width: `${(count / max) * 100}%` }}/></i><strong>{count}</strong></div>; })}</div></section><section><h3>Time of day</h3><div className="breakdown-bars time-blocks">{callBreakdown.times.map((block) => { const max = Math.max(1, ...callBreakdown.times.map((item) => item.count)); return <div key={block.label}><span>{block.label}<small>{block.detail}</small></span><i><b style={{ width: `${(block.count / max) * 100}%` }}/></i><strong>{block.count}</strong></div>; })}</div>{callBreakdown.missingTime > 0 && <p className="missing-time-note">{callBreakdown.missingTime} call{callBreakdown.missingTime === 1 ? "" : "s"} without a recorded time are excluded from the time-of-day bars.</p>}</section></div></section></div>}
  </section>;
}
