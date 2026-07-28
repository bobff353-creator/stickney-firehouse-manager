"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatEmployeeName } from "./employee-names";
import { formatMilitaryTime } from "./military-time";
import ChiefBoardPanel from "./chief-board-panel";
import StaffingRotation, { type NewMember, type StaffingPerson } from "./staffing-rotation";

type BoardData = { asOf: string; currentShift: string; onDuty: StaffingPerson[]; newMembers: NewMember[]; officerInCharge: string | null; staffing: { filled: number; required: number; complete: boolean }; equipmentIssues: Array<{ item: string; status: string; detail: string }>; activeCalls: Array<{ reportNumber: string; timeOut: string; respondingUnits: string; address: string; callType: string; narrative?: string; source?: string }>; apparatus: Array<{ unit: string; status: string }>; error?: string };
type CurrentDuty = { dayOfWeek: number; shiftKey: "morning" | "afternoon" | "night"; duty: string };
type CloseCallReport = { title: string; url: string; publishedAt: string; excerpt: string };
type UsfaFatality = { id: number; name: string; department: string; location: string; deathDate: string; url: string };
type UsfaData = { year: number; total: number; items: UsfaFatality[]; stale?: boolean };
type WeatherDay = { date: string; condition: string; high: number; low: number; precipitationChance: number; windGust: number };
type WeatherData = { location: string; days: WeatherDay[]; source?: string; detailUrl?: string };
type Rotation = "equipment" | "duty" | "news" | "fatalities";
type HeaderRotation = "title" | "today" | "tomorrow";
const rotationOrder: Rotation[] = ["equipment", "duty", "news", "fatalities"];
const headerRotationOrder: HeaderRotation[] = ["title", "today", "tomorrow"];
const alertTones = [
  { id: "station-chime", label: "Station Chime", notes: [659, 784, 988] },
  { id: "dispatch-triple", label: "Dispatch Triple", notes: [880, 880, 880] },
  { id: "rising-alert", label: "Rising Alert", notes: [440, 660, 880, 1100] },
  { id: "two-tone", label: "Two-Tone Page", notes: [600, 900, 600, 900] },
  { id: "bell", label: "Bell Sequence", notes: [1047, 784, 1047] },
  { id: "warble", label: "Warble", notes: [740, 988, 740, 988, 740] },
  { id: "low-high", label: "Low–High", notes: [392, 784, 392, 784] },
  { id: "priority", label: "Priority Alert", notes: [988, 988, 659, 988] },
  { id: "digital", label: "Digital Page", notes: [523, 659, 784, 1047] },
  { id: "soft-chime", label: "Soft Chime", notes: [523, 659, 784] },
] as const;
type AlertTone = typeof alertTones[number]["id"];
const alertToneIds = new Set<string>(alertTones.map((tone) => tone.id));
const displayName = formatEmployeeName;
const shiftLabel = (value: string) => value === "morning" ? "6:00 AM – Noon" : value === "afternoon" ? "Noon – 6:00 PM" : "6:00 PM – 6:00 AM";
function nextShift(now: Date) { const local = new Date(now.toLocaleString("en-US", { timeZone: "America/Chicago" })); const minutes = local.getHours() * 60 + local.getMinutes(); const target = minutes < 360 ? 360 : minutes < 720 ? 720 : minutes < 1080 ? 1080 : 1800; const remaining = target - minutes; return { label: target === 360 ? "6:00 AM" : target === 720 ? "Noon" : "6:00 PM", remaining: `${Math.floor(remaining / 60)}h ${remaining % 60}m` }; }

export default function OperationsBoard({ tvMode = false, onTvModeChange }: { tvMode?: boolean; onTvModeChange?: (enabled: boolean) => void }) {
  const [data, setData] = useState<BoardData | null>(null), [currentDuty, setCurrentDuty] = useState<CurrentDuty | null>(null), [news, setNews] = useState<CloseCallReport[]>([]), [fatalities, setFatalities] = useState<UsfaData | null>(null), [weather, setWeather] = useState<WeatherData | null>(null), [error, setError] = useState(""), [clock, setClock] = useState(new Date()), [rotation, setRotation] = useState<Rotation>("equipment"), [headerRotation, setHeaderRotation] = useState<HeaderRotation>("title");
  const [alertEnabled, setAlertEnabled] = useState(false), [alertTone, setAlertTone] = useState<AlertTone>("station-chime"), [alertPanelOpen, setAlertPanelOpen] = useState(false);
  const alertEnabledRef = useRef(false), alertToneRef = useRef<AlertTone>("station-chime"), seenCallIdsRef = useRef<Set<string> | null>(null), audioContextRef = useRef<AudioContext | null>(null);
  const playAlert = useCallback(async (toneId = alertToneRef.current) => {
    const AudioContextClass = window.AudioContext;
    const context = audioContextRef.current ?? new AudioContextClass();
    audioContextRef.current = context;
    if (context.state === "suspended") await context.resume();
    const tone = alertTones.find((item) => item.id === toneId) ?? alertTones[0];
    const start = context.currentTime + .03;
    tone.notes.forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const noteStart = start + index * .2;
      oscillator.type = toneId === "soft-chime" ? "sine" : toneId === "digital" ? "square" : "triangle";
      oscillator.frequency.setValueAtTime(frequency, noteStart);
      gain.gain.setValueAtTime(.0001, noteStart);
      gain.gain.exponentialRampToValueAtTime(toneId === "soft-chime" ? .08 : .16, noteStart + .025);
      gain.gain.exponentialRampToValueAtTime(.0001, noteStart + .17);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(noteStart);
      oscillator.stop(noteStart + .18);
    });
  }, []);
  const load = useCallback(async () => { const [dashboardResponse, dutiesResponse, newsResponse, fatalitiesResponse, weatherResponse] = await Promise.all([fetch("/api/dashboard"), fetch("/api/daily-duties"), fetch("/api/close-call-news"), fetch("/api/usfa-fatalities"), fetch("/api/weather")]); const result = await dashboardResponse.json() as BoardData; const duties = await dutiesResponse.json() as { currentDuty?: CurrentDuty | null }; const reports = await newsResponse.json() as { items?: CloseCallReport[] }; const usfa = await fatalitiesResponse.json() as UsfaData; const forecast = await weatherResponse.json() as WeatherData; if (dashboardResponse.ok) { const incomingIds = new Set(result.activeCalls.map((call) => call.reportNumber).filter(Boolean)); if (seenCallIdsRef.current) { const hasNewCall = [...incomingIds].some((id) => !seenCallIdsRef.current?.has(id)); if (hasNewCall && alertEnabledRef.current) void playAlert(); incomingIds.forEach((id) => seenCallIdsRef.current?.add(id)); } else { seenCallIdsRef.current = incomingIds; } setData(result); setError(""); } else setError(result.error || "Unable to load live operations"); if (dutiesResponse.ok) setCurrentDuty(duties.currentDuty ?? null); if (newsResponse.ok) setNews(reports.items ?? []); if (fatalitiesResponse.ok) setFatalities(usfa); if (weatherResponse.ok) setWeather(forecast); }, [playAlert]);
  useEffect(() => { const storedTone = window.localStorage.getItem("stickney-call-alert-tone") || ""; const selectedTone = alertToneIds.has(storedTone) ? storedTone as AlertTone : "station-chime"; const enabled = window.localStorage.getItem("stickney-call-alert-enabled") === "true"; setAlertTone(selectedTone); setAlertEnabled(enabled); alertToneRef.current = selectedTone; alertEnabledRef.current = enabled; }, []);
  useEffect(() => { const initial = window.setTimeout(() => void load(), 0); const refresh = window.setInterval(() => void load(), 30000); const ticker = window.setInterval(() => setClock(new Date()), 1000); const rotate = window.setInterval(() => setRotation((current) => rotationOrder[(rotationOrder.indexOf(current) + 1) % rotationOrder.length]), 12000); const rotateHeader = window.setInterval(() => setHeaderRotation((current) => headerRotationOrder[(headerRotationOrder.indexOf(current) + 1) % headerRotationOrder.length]), 8000); return () => { window.clearTimeout(initial); window.clearInterval(refresh); window.clearInterval(ticker); window.clearInterval(rotate); window.clearInterval(rotateHeader); }; }, [load]);
  const next = useMemo(() => nextShift(clock), [clock]);
  const activeCall = data?.activeCalls[0];
  const headerWeather = headerRotation === "today" ? weather?.days[0] : headerRotation === "tomorrow" ? weather?.days[1] : null;
  async function enterTvMode() {
    onTvModeChange?.(true);
    try {
      await document.documentElement.requestFullscreen();
    } catch {
      // Some TV browsers do not expose the Fullscreen API. The distraction-free
      // layout still works and the device browser can be placed in full screen.
    }
  }
  async function exitTvMode() {
    if (document.fullscreenElement) await document.exitFullscreen();
    onTvModeChange?.(false);
  }
  async function toggleCallAlerts() {
    const enabled = !alertEnabledRef.current;
    alertEnabledRef.current = enabled;
    setAlertEnabled(enabled);
    window.localStorage.setItem("stickney-call-alert-enabled", String(enabled));
    if (enabled) await playAlert();
  }
  function selectAlertTone(value: string) {
    if (!alertToneIds.has(value)) return;
    const selected = value as AlertTone;
    alertToneRef.current = selected;
    setAlertTone(selected);
    window.localStorage.setItem("stickney-call-alert-tone", selected);
  }
  return <section className={`operations-board${tvMode ? " tv-display" : ""}`}>
    <div className="board-display-controls">
      {alertPanelOpen && <div className="call-alert-settings"><strong>New-call sound</strong><label><span>Alert tone</span><select value={alertTone} onChange={(event) => selectAlertTone(event.target.value)}>{alertTones.map((tone) => <option value={tone.id} key={tone.id}>{tone.label}</option>)}</select></label><div><button type="button" onClick={() => void playAlert(alertTone)}>Preview</button><button type="button" className={alertEnabled ? "enabled" : ""} onClick={() => void toggleCallAlerts()}>{alertEnabled ? "Disable alerts" : "Enable call alerts"}</button></div><small>Saved on this TV. Sounds only for newly received call numbers.</small></div>}
      <div className="board-control-buttons"><button type="button" onClick={() => setAlertPanelOpen((open) => !open)} aria-expanded={alertPanelOpen}>Call sound: {alertEnabled ? "On" : "Off"}</button>{tvMode
        ? <button type="button" onClick={() => void exitTvMode()} aria-label="Exit TV display mode">Exit TV mode</button>
        : <button type="button" onClick={() => void enterTvMode()} aria-label="Open the Live Operations Board in full-screen TV mode">TV full screen</button>}</div>
    </div>
    <header className="board-header"><div className="board-header-rotation" aria-live="polite"><p>Stickney Fire Department</p>{headerRotation === "title" ? <div className="board-title-slide"><h1>Live Operations Board</h1><span>{data ? shiftLabel(data.currentShift) : "Loading current shift…"}</span></div> : headerWeather ? <div className="board-weather-slide"><span className="weather-day">{headerRotation === "today" ? "Today’s Berwyn weather" : "Tomorrow’s Berwyn weather"}</span><h1>{headerWeather.condition}</h1><div><strong>{headerWeather.high}°</strong><span>High</span><b>{headerWeather.low}°</b><span>Low</span><small>{headerWeather.precipitationChance}% rain · Wind {headerWeather.windGust} mph</small></div>{weather?.detailUrl && <a href={weather.detailUrl} target="_blank" rel="noreferrer">Full Berwyn forecast on Weather.com ↗</a>}</div> : <div className="board-title-slide"><h1>Live Operations Board</h1><span>Weather forecast temporarily unavailable</span></div>}<div className="board-header-dots" aria-label="Header rotation"><button className={headerRotation === "title" ? "active" : ""} aria-label="Show board title" onClick={() => setHeaderRotation("title")}/><button className={headerRotation === "today" ? "active" : ""} aria-label="Show today’s weather" onClick={() => setHeaderRotation("today")}/><button className={headerRotation === "tomorrow" ? "active" : ""} aria-label="Show tomorrow’s weather" onClick={() => setHeaderRotation("tomorrow")}/><span>Rotates every 8 seconds</span></div></div><div className="board-clock"><strong>{clock.toLocaleTimeString("en-US", { timeZone: "America/Chicago", hour: "numeric", minute: "2-digit", second: "2-digit" })}</strong><span>{clock.toLocaleDateString("en-US", { timeZone: "America/Chicago", weekday: "long", month: "long", day: "numeric" })}</span><small><i/> Live · refreshes every 30 seconds</small></div></header>
    {error && <div className="board-alert">{error}<button onClick={() => void load()}>Retry</button></div>}
    <div className="board-summary"><article className={data?.staffing.complete ? "clear" : "warning"}><span>Staffing</span><strong>{data?.staffing.filled ?? "—"} / {data?.staffing.required ?? 4}</strong><small>{data?.staffing.complete ? "Complete" : "Coverage needs attention"}</small></article><article className={data?.officerInCharge ? "clear" : "warning"}><span>Officer in charge</span><strong>{data?.officerInCharge ? displayName(data.officerInCharge) : "Not signed in"}</strong><small>Current shift command</small></article><article className={`active-call-summary ${activeCall ? "active" : "clear"}`}><span>{data?.activeCalls.length ? `Active call${data.activeCalls.length > 1 ? ` · ${data.activeCalls.length} total` : ""}` : "Active call"}</span>{activeCall ? <><strong>{activeCall.callType}</strong><b>{activeCall.address || "Address not entered"}</b>{activeCall.narrative && <em>{activeCall.narrative}</em>}<small>{activeCall.respondingUnits || "Units pending"} · {activeCall.timeOut ? formatMilitaryTime(activeCall.timeOut) : "Time pending"}{activeCall.source ? ` · ${activeCall.source}` : ""}</small></> : <><strong>None</strong><small>No open calls</small></>}</article><article><span>Next shift change</span><strong>{next.label}</strong><small>In {next.remaining}</small></article></div>
    <div className="board-grid redesigned"><ChiefBoardPanel />
      <StaffingRotation mode="board" onDuty={data?.onDuty ?? []} newMembers={data?.newMembers ?? []} />
      <section className={`board-panel equipment rotating-panel ${rotation}`} aria-live="polite"><header><h2>{rotation === "equipment" ? "Equipment issues" : rotation === "duty" ? "Current daily duty" : rotation === "news" ? "Firefighter Close Calls" : "U.S. Firefighter Line-of-Duty Deaths"}</h2><span>{rotation === "equipment" ? `${data?.equipmentIssues.length ?? 0} reported` : rotation === "duty" ? `${clock.toLocaleDateString("en-US", { timeZone: "America/Chicago", weekday: "long" })} · ${shiftLabel(currentDuty?.shiftKey ?? data?.currentShift ?? "night")}` : rotation === "news" ? "Newest 3 · updates automatically" : "USFA · latest 5"}</span></header><div className="rotation-content">{rotation === "equipment" ? data?.equipmentIssues.length ? data.equipmentIssues.map((issue) => <article key={issue.item}><b>{issue.item}</b><strong>{issue.status}</strong><p>{issue.detail || "No details entered"}</p></article>) : <p className="board-empty clear">✓ No equipment issues reported</p> : rotation === "duty" ? currentDuty ? <article className="current-duty-card"><span>NOW</span><b>{currentDuty.shiftKey[0].toUpperCase() + currentDuty.shiftKey.slice(1)} duty</b><p>{currentDuty.duty}</p></article> : <p className="board-empty">No duty is entered for the current shift.</p> : rotation === "news" ? news.length ? <div className="close-call-list">{news.map((report) => <a href={report.url} target="_blank" rel="noreferrer" key={report.url} aria-label={`${report.title}. Open the full Firefighter Close Calls report.`}><time><span>Posted</span>{new Date(report.publishedAt).toLocaleDateString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", year: "numeric" })}</time><div><span className="close-call-kicker">Incident report</span><strong>{report.title}</strong>{report.excerpt && <p>{report.excerpt}</p>}<small>Read the complete report <b aria-hidden="true">↗</b></small></div></a>)}</div> : <p className="board-empty">Latest reports are temporarily unavailable.</p> : fatalities ? <div className="fatality-board"><div className="fatality-total"><strong>{fatalities.total}</strong><div><b>firefighter deaths in {fatalities.year}</b><span>{fatalities.stale ? "Last confirmed USFA data" : "Current USFA reported total"}</span></div></div><div className="fatality-list">{fatalities.items.map((person) => <a href={person.url} target="_blank" rel="noreferrer" key={person.id}><time>{new Date(person.deathDate).toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric" })}</time><div><strong>{person.name}</strong><span>{person.department}</span><small>{person.location}</small></div><b aria-hidden="true">↗</b></a>)}</div><p className="fatality-source">Provisional on-duty fatality information from the U.S. Fire Administration.</p></div> : <p className="board-empty">USFA fatality information is temporarily unavailable.</p>}</div><footer className="rotation-indicator"><button className={rotation === "equipment" ? "active" : ""} aria-label="Show equipment issues" onClick={() => setRotation("equipment")}/><button className={rotation === "duty" ? "active" : ""} aria-label="Show current daily duty" onClick={() => setRotation("duty")}/><button className={rotation === "news" ? "active" : ""} aria-label="Show Firefighter Close Calls reports" onClick={() => setRotation("news")}/><button className={rotation === "fatalities" ? "active" : ""} aria-label="Show USFA firefighter fatalities" onClick={() => setRotation("fatalities")}/><span>Rotates every 12 seconds</span></footer></section></div>
    <section className="board-panel apparatus apparatus-wide"><header><h2>Apparatus status</h2><span>From active calls</span></header><div>{data?.apparatus.map((unit) => <article className={unit.status === "Committed to call" ? "committed" : "unknown"} key={unit.unit}><b>Unit {unit.unit}</b><span>{unit.status}</span></article>)}</div><p className="board-source-note">Availability is not assumed. Units only show “Committed” when listed on an active call.</p></section>
  </section>;
}
