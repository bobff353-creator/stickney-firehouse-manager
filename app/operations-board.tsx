"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatEmployeeName } from "./employee-names";
import { formatMilitaryTime } from "./military-time";
import { nextOperationsShiftChange } from "./operations-shift-time";
import ChiefBoardPanel from "./chief-board-panel";
import StaffingRotation, { type NewMember, type StaffingPerson } from "./staffing-rotation";
import { dailyFleetCheckUrgency } from "./lib/fleet-projections";

type BoardData = { asOf: string; currentShift: string; onDuty: StaffingPerson[]; newMembers: NewMember[]; officerInCharge: string | null; staffing: { filled: number; required: number; complete: boolean }; equipmentIssues: Array<{ id?: string; item: string; status: string; detail: string }>; activeCalls: Array<{ reportNumber: string; timeOut: string; respondingUnits: string; address: string; callType: string; narrative?: string; source?: string }>; apparatus: Array<{ unit: string; status: string }>; error?: string };
type CurrentDuty = { dayOfWeek: number; shiftKey: "morning" | "afternoon" | "night"; duty: string; fleetChecks?: Array<{ apparatusId: string; unit: string; status: "pending" | "in_progress" | "completed" }> };
type DailyFleetCheck = { apparatusId: string; unit: string; status: "pending" | "in_progress"; startedAt: string | null };
type CloseCallReport = { title: string; url: string; publishedAt: string; excerpt: string };
type UsfaFatality = { id: number; name: string; department: string; location: string; deathDate: string; url: string };
type UsfaData = { year: number; total: number; items: UsfaFatality[]; stale?: boolean };
type WeatherDay = { date: string; condition: string; high: number; low: number; precipitationChance: number; windGust: number };
type WeatherData = { location: string; days: WeatherDay[]; source?: string; detailUrl?: string };
type FleetApparatus = { id:string; unitNumber:string; name:string; status:string };
type TrainingCourse = { title: string; dates: string; endDate: string; location?: string; url: string };
type TrainingProvider = { name: string; shortName: string; sourceUrl: string; checked: string; courses: TrainingCourse[] };
type Rotation = "equipment" | "duty" | "news" | "fatalities" | "romeoville" | "ifsi" | "nipsta";
type HeaderRotation = "title" | "today" | "tomorrow";
const rotationOrder: Rotation[] = ["equipment", "duty", "news", "fatalities", "romeoville", "ifsi", "nipsta"];
const headerRotationOrder: HeaderRotation[] = ["title", "today", "tomorrow"];
const trainingProviders: Record<"romeoville" | "ifsi" | "nipsta", TrainingProvider> = {
  romeoville: {
    name: "Romeoville Fire Academy",
    shortName: "Romeoville",
    sourceUrl: "https://www.romeoville.org/562/Fire-Rescue-Courses",
    checked: "July 28, 2026",
    courses: [
      { title: "Basic Operations Firefighter Academy #6", dates: "Aug 3–Oct 2", endDate: "2026-10-02", url: "https://www.romeoville.org/DocumentCenter/View/15985/RFA-2026-Course-Catalog" },
      { title: "Fire Apparatus Engineer", dates: "Aug 3–7", endDate: "2026-08-07", url: "https://www.romeoville.org/DocumentCenter/View/15985/RFA-2026-Course-Catalog" },
      { title: "Common Passenger Vehicle Rescue", dates: "Aug 3–7", endDate: "2026-08-07", url: "https://www.romeoville.org/DocumentCenter/View/15985/RFA-2026-Course-Catalog" },
      { title: "Advanced SCBA", dates: "Aug 10–12", endDate: "2026-08-12", url: "https://www.romeoville.org/DocumentCenter/View/15985/RFA-2026-Course-Catalog" },
      { title: "Rope Operations", dates: "Aug 10–14", endDate: "2026-08-14", location: "North Aurora", url: "https://www.romeoville.org/DocumentCenter/View/15985/RFA-2026-Course-Catalog" },
    ],
  },
  ifsi: {
    name: "Illinois Fire Service Institute",
    shortName: "IFSI",
    sourceUrl: "https://www.fsi.illinois.edu/content/courses/",
    checked: "July 28, 2026",
    courses: [
      { title: "Down and Dirty Hydraulics", dates: "Jul 29", endDate: "2026-07-29", location: "Polo", url: "https://www.fsi.illinois.edu/content/courses/schedule/" },
      { title: "Elevator Equipment, Function and Rescue Considerations", dates: "Jul 29", endDate: "2026-07-29", location: "Oak Lawn", url: "https://www.fsi.illinois.edu/content/courses/schedule/" },
      { title: "Fire Origin and Cause Awareness", dates: "Jul 29", endDate: "2026-07-29", location: "Danville", url: "https://www.fsi.illinois.edu/content/courses/schedule/" },
      { title: "Mobile Water Supply Operations", dates: "Jul 30", endDate: "2026-07-30", location: "Tower Hill", url: "https://www.fsi.illinois.edu/content/courses/schedule/" },
      { title: "State of Illinois Traffic Incident Management", dates: "Jul 30", endDate: "2026-07-30", location: "Anna", url: "https://www.fsi.illinois.edu/content/courses/schedule/" },
    ],
  },
  nipsta: {
    name: "NIPSTA Fire & Technical Rescue",
    shortName: "NIPSTA",
    sourceUrl: "https://nipsta.org/175/Fire-Technical-Rescue-Training",
    checked: "July 28, 2026",
    courses: [
      { title: "Advanced Technician Firefighter", dates: "Aug 24–28", endDate: "2026-08-28", location: "NIPSTA", url: "https://nipsta.org/360/Advanced-Technician-Firefighter" },
      { title: "Rope Technician", dates: "Sep 8–11", endDate: "2026-09-11", location: "NIPSTA", url: "https://nipsta.org/369/Rope-Technician" },
      { title: "Confined Space Entrant, Attendant & Entry Supervisor", dates: "Sep 9", endDate: "2026-09-09", location: "NIPSTA Campus", url: "https://nipsta.org/568/Con-Space-Entrant-Attendant-Entry-Superv" },
      { title: "Advanced Technician Firefighter", dates: "Nov 16–20", endDate: "2026-11-20", location: "NIPSTA", url: "https://nipsta.org/360/Advanced-Technician-Firefighter" },
    ],
  },
};
type AlertSegment = { frequencies: readonly number[]; duration: number; waveform?: OscillatorType; sweepTo?: number };
const alertTones = [
  { id: "minitor-two-tone", label: "Minitor Two-Tone Page", segments: [{ frequencies: [600], duration: 1, waveform: "sine" }, { frequencies: [900], duration: 3, waveform: "sine" }] },
  { id: "quick-call", label: "Quick-Call Two-Tone", segments: [{ frequencies: [1006], duration: 1, waveform: "sine" }, { frequencies: [1180], duration: 3, waveform: "sine" }] },
  { id: "plectron", label: "Plectron Tone-Out", segments: [{ frequencies: [1082], duration: 1, waveform: "sine" }, { frequencies: [701], duration: 3, waveform: "sine" }] },
  { id: "station-hi-lo", label: "Station Hi-Lo Alert", segments: [580, 760, 580, 760, 580, 760, 580, 760].map((frequency) => ({ frequencies: [frequency], duration: .32, waveform: "triangle" as OscillatorType })) },
  { id: "station-klaxon", label: "Station Klaxon", segments: [1, 0, 1, 0, 1].map((on) => ({ frequencies: on ? [440, 466] : [], duration: on ? .55 : .18, waveform: "sawtooth" as OscillatorType })) },
  { id: "siren-burst", label: "Electronic Siren Burst", segments: [{ frequencies: [320], sweepTo: 960, duration: 1.2, waveform: "sawtooth" }, { frequencies: [960], sweepTo: 360, duration: 1.2, waveform: "sawtooth" }] },
  { id: "air-horn", label: "Dual Air-Horn Alert", segments: [{ frequencies: [370, 493], duration: .85, waveform: "sawtooth" }, { frequencies: [], duration: .25 }, { frequencies: [370, 493], duration: .85, waveform: "sawtooth" }] },
  { id: "house-bell", label: "Firehouse Bell", segments: [1, 0, 1, 0, 1, 0, 1].map((on) => ({ frequencies: on ? [784, 1568] : [], duration: on ? .22 : .18, waveform: "sine" as OscillatorType })) },
  { id: "dispatch-warble", label: "Dispatch Warble", segments: [720, 980, 720, 980, 720, 980, 720, 980, 720, 980].map((frequency) => ({ frequencies: [frequency], duration: .16, waveform: "triangle" as OscillatorType })) },
  { id: "three-chime", label: "Three-Chime Station Alert", segments: [{ frequencies: [523, 659, 784], duration: .7, waveform: "sine" }, { frequencies: [], duration: .18 }, { frequencies: [659, 784, 988], duration: .7, waveform: "sine" }, { frequencies: [], duration: .18 }, { frequencies: [784, 988, 1175], duration: 1.1, waveform: "sine" }] },
] as const satisfies readonly { id: string; label: string; segments: readonly AlertSegment[] }[];
type AlertTone = typeof alertTones[number]["id"];
const alertToneIds = new Set<string>(alertTones.map((tone) => tone.id));
const displayName = formatEmployeeName;
const shiftLabel = (value: string) => value === "morning" ? "6:00 AM – Noon" : value === "afternoon" ? "Noon – 6:00 PM" : "6:00 PM – 6:00 AM";

function TrainingCourses({ provider, today }: { provider: TrainingProvider; today: string }) {
  const upcoming = provider.courses.filter((course) => course.endDate >= today).slice(0, 5);
  return <div className="training-board">
    <div className="training-provider"><span>Upcoming training</span><strong>{provider.name}</strong><small>Official schedule checked {provider.checked}</small></div>
    <div className="training-course-list">{upcoming.length ? upcoming.map((course) => <a href={course.url} target="_blank" rel="noreferrer" key={`${course.title}-${course.dates}`}><time>{course.dates}<small>2026</small></time><div><strong>{course.title}</strong>{course.location && <span>{course.location}</span>}</div><b aria-hidden="true">↗</b></a>) : <p className="board-empty">No future classes remain in the confirmed schedule.</p>}</div>
    <a className="training-source" href={provider.sourceUrl} target="_blank" rel="noreferrer">View {provider.shortName} official courses and registration ↗</a>
    <p className="training-disclaimer">Dates and availability can change. Confirm with the training provider before registering.</p>
  </div>;
}

export default function OperationsBoard({ tvMode = false, onTvModeChange, onNewActiveCall }: { tvMode?: boolean; onTvModeChange?: (enabled: boolean) => void; onNewActiveCall?: (call: BoardData["activeCalls"][number]) => void }) {
  const [data, setData] = useState<BoardData | null>(null), [currentDuty, setCurrentDuty] = useState<CurrentDuty | null>(null), [dailyFleetChecks, setDailyFleetChecks] = useState<DailyFleetCheck[]>([]), [news, setNews] = useState<CloseCallReport[]>([]), [fatalities, setFatalities] = useState<UsfaData | null>(null), [weather, setWeather] = useState<WeatherData | null>(null), [error, setError] = useState(""), [clock, setClock] = useState(new Date()), [rotation, setRotation] = useState<Rotation>("equipment"), [headerRotation, setHeaderRotation] = useState<HeaderRotation>("title");
  const [alertEnabled, setAlertEnabled] = useState(false), [alertTone, setAlertTone] = useState<AlertTone>("minitor-two-tone"), [alertPanelOpen, setAlertPanelOpen] = useState(false);
  const [rotationPaused,setRotationPaused]=useState(false),[lastRefresh,setLastRefresh]=useState<Date|null>(null);
  const alertEnabledRef = useRef(false), alertToneRef = useRef<AlertTone>("minitor-two-tone"), seenCallIdsRef = useRef<Set<string> | null>(null), audioContextRef = useRef<AudioContext | null>(null), onNewActiveCallRef = useRef(onNewActiveCall);
  const playAlert = useCallback(async (toneId = alertToneRef.current) => {
    const AudioContextClass = window.AudioContext;
    const context = audioContextRef.current ?? new AudioContextClass();
    audioContextRef.current = context;
    if (context.state === "suspended") await context.resume();
    const tone = alertTones.find((item) => item.id === toneId) ?? alertTones[0];
    let segmentStart = context.currentTime + .04;
    tone.segments.forEach((segment: AlertSegment) => {
      if (!segment.frequencies.length) {
        segmentStart += segment.duration;
        return;
      }
      segment.frequencies.forEach((frequency) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const filter = context.createBiquadFilter();
        oscillator.type = segment.waveform ?? "sine";
        oscillator.frequency.setValueAtTime(frequency, segmentStart);
        if (segment.sweepTo) oscillator.frequency.exponentialRampToValueAtTime(segment.sweepTo, segmentStart + segment.duration);
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(2400, segmentStart);
        gain.gain.setValueAtTime(.0001, segmentStart);
        gain.gain.exponentialRampToValueAtTime(.15 / Math.sqrt(segment.frequencies.length), segmentStart + .035);
        gain.gain.setValueAtTime(.15 / Math.sqrt(segment.frequencies.length), Math.max(segmentStart + .04, segmentStart + segment.duration - .06));
        gain.gain.exponentialRampToValueAtTime(.0001, segmentStart + segment.duration);
        oscillator.connect(filter).connect(gain).connect(context.destination);
        oscillator.start(segmentStart);
        oscillator.stop(segmentStart + segment.duration + .02);
      });
      segmentStart += segment.duration;
    });
  }, []);
  const load = useCallback(async () => {
    try {
      const [dashboardResponse, dutiesResponse, newsResponse, fatalitiesResponse, weatherResponse, fleetResponse] = await Promise.all([
        fetch("/api/dashboard"),
        fetch("/api/daily-duties"),
        fetch("/api/close-call-news"),
        fetch("/api/usfa-fatalities"),
        fetch("/api/weather"),
        fetch("/api/suite-context"),
      ]);
      const [result, duties, reports, usfa, forecast, fleet] = await Promise.all([
        dashboardResponse.json() as Promise<BoardData>,
        dutiesResponse.json().catch(() => ({})) as Promise<{ currentDuty?: CurrentDuty | null; dailyFleetChecks?: DailyFleetCheck[] }>,
        newsResponse.json().catch(() => ({})) as Promise<{ items?: CloseCallReport[] }>,
        fatalitiesResponse.json().catch(() => null) as Promise<UsfaData | null>,
        weatherResponse.json().catch(() => null) as Promise<WeatherData | null>,
        fleetResponse.json().catch(() => ({})) as Promise<{ apparatus?: FleetApparatus[] }>,
      ]);
      if (!dashboardResponse.ok) {
        setError(result.error || "Unable to load live operations");
        return;
      }
      const incomingIds = new Set(result.activeCalls.map((call) => call.reportNumber).filter(Boolean));
      if (seenCallIdsRef.current) {
        const newCall = result.activeCalls.find((call) => call.reportNumber && !seenCallIdsRef.current?.has(call.reportNumber));
        if (newCall && alertEnabledRef.current) void playAlert();
        if (newCall) onNewActiveCallRef.current?.(newCall);
        incomingIds.forEach((id) => seenCallIdsRef.current?.add(id));
      } else {
        seenCallIdsRef.current = incomingIds;
      }
      const committed = new Set(result.activeCalls.flatMap((call) => call.respondingUnits.split(/[\s,;/]+/)).filter(Boolean));
      const fleetStatuses = (fleet.apparatus ?? []).map((unit) => ({
        unit: unit.unitNumber || unit.name,
        status: committed.has(unit.unitNumber) ? "Committed to call" : unit.status.toLowerCase().replaceAll(/[\s_-]/g, "") === "inservice" ? "Available" : unit.status || "Status not reported",
      }));
      setData({ ...result, apparatus: fleetStatuses.length ? fleetStatuses : result.apparatus });
      setLastRefresh(new Date());
      setError("");
      if (dutiesResponse.ok) {
        setCurrentDuty(duties.currentDuty ?? null);
        setDailyFleetChecks(duties.dailyFleetChecks ?? []);
      }
      if (newsResponse.ok) setNews(reports.items ?? []);
      if (fatalitiesResponse.ok && usfa) setFatalities(usfa);
      if (weatherResponse.ok && forecast) setWeather(forecast);
    } catch {
      setError("Live updates are temporarily delayed. The last confirmed board remains on screen.");
    }
  }, [playAlert]);
  useEffect(() => { onNewActiveCallRef.current = onNewActiveCall; }, [onNewActiveCall]);
  useEffect(() => { const timer = window.setTimeout(() => { const storedTone = window.localStorage.getItem("stickney-call-alert-tone") || ""; const selectedTone = alertToneIds.has(storedTone) ? storedTone as AlertTone : "minitor-two-tone"; const enabled = window.localStorage.getItem("stickney-call-alert-enabled") === "true"; setAlertTone(selectedTone); setAlertEnabled(enabled); alertToneRef.current = selectedTone; alertEnabledRef.current = enabled; }, 0); return () => window.clearTimeout(timer); }, []);
  useEffect(() => { const initial = window.setTimeout(() => void load(), 0); const refresh = window.setInterval(() => void load(), 30000); const ticker = window.setInterval(() => setClock(new Date()), 1000); const rotate = rotationPaused?0:window.setInterval(() => setRotation((current) => rotationOrder[(rotationOrder.indexOf(current) + 1) % rotationOrder.length]), 12000); const rotateHeader = rotationPaused?0:window.setInterval(() => setHeaderRotation((current) => headerRotationOrder[(headerRotationOrder.indexOf(current) + 1) % headerRotationOrder.length]), 8000); return () => { window.clearTimeout(initial); window.clearInterval(refresh); window.clearInterval(ticker); if(rotate)window.clearInterval(rotate);if(rotateHeader)window.clearInterval(rotateHeader); }; }, [load,rotationPaused]);
  const next = useMemo(() => nextOperationsShiftChange(clock), [clock]);
  const activeCall = data?.activeCalls[0];
  const headerWeather = headerRotation === "today" ? weather?.days[0] : headerRotation === "tomorrow" ? weather?.days[1] : null;
  const today = clock.toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
  const chicagoTimeParts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(clock);
  const chicagoMinutes = Number(chicagoTimeParts.find((part) => part.type === "hour")?.value || 0) * 60 + Number(chicagoTimeParts.find((part) => part.type === "minute")?.value || 0);
  const dailyCheckUrgency = dailyFleetCheckUrgency(chicagoMinutes);
  const dailyChecksNeedAttention = dailyFleetChecks.length > 0 && dailyCheckUrgency !== "scheduled";
  const scheduledWeeklyChecks = currentDuty?.fleetChecks ?? [];
  const activeWeeklyChecks = scheduledWeeklyChecks.filter((check) => check.status !== "completed");
  const weeklyChecksCompleted = scheduledWeeklyChecks.length > 0 && activeWeeklyChecks.length === 0;
  const feedDegraded=Boolean(error)||!lastRefresh||clock.getTime()-lastRefresh.getTime()>75000;
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
      <div className="board-control-buttons"><span className={`board-heartbeat ${feedDegraded?"degraded":""}`}><i/>{feedDegraded?"Feed delayed":`Updated ${lastRefresh?.toLocaleTimeString([],{hour:"numeric",minute:"2-digit",second:"2-digit"})}`}</span><button type="button" onClick={()=>setRotationPaused((current)=>!current)}>{rotationPaused?"Resume rotation":"Pause rotation"}</button><button type="button" onClick={() => setAlertPanelOpen((open) => !open)} aria-expanded={alertPanelOpen}>Call sound: {alertEnabled ? "On" : "Off"}</button>{tvMode
        ? <button type="button" onClick={() => void exitTvMode()} aria-label="Exit TV display mode">Exit TV mode</button>
        : <button type="button" onClick={() => void enterTvMode()} aria-label="Open the Live Operations Board in full-screen TV mode">TV full screen</button>}</div>
    </div>
    <header className="board-header"><div className="board-header-rotation" aria-live="polite"><p>Stickney Fire Department</p>{headerRotation === "title" ? <div className="board-title-slide"><h1>Live Operations Board</h1><span>{data ? shiftLabel(data.currentShift) : "Loading current shift…"}</span></div> : headerWeather ? <div className="board-weather-slide"><span className="weather-day">{headerRotation === "today" ? "Today’s Berwyn weather" : "Tomorrow’s Berwyn weather"}</span><h1>{headerWeather.condition}</h1><div><strong>{headerWeather.high}°</strong><span>High</span><b>{headerWeather.low}°</b><span>Low</span><small>{headerWeather.precipitationChance}% rain · Wind {headerWeather.windGust} mph</small></div>{weather?.detailUrl && <a href={weather.detailUrl} target="_blank" rel="noreferrer">Full Berwyn forecast on Weather.com ↗</a>}</div> : <div className="board-title-slide"><h1>Live Operations Board</h1><span>Weather forecast temporarily unavailable</span></div>}</div><div className="board-clock"><strong>{clock.toLocaleTimeString("en-US", { timeZone: "America/Chicago", hour: "numeric", minute: "2-digit", second: "2-digit" })}</strong><span>{clock.toLocaleDateString("en-US", { timeZone: "America/Chicago", weekday: "long", month: "long", day: "numeric" })}</span><small><i/> Live · refreshes every 30 seconds</small></div></header>
    {error && <div className="board-alert">{error}<button onClick={() => void load()}>Retry</button></div>}
    <div className="board-summary"><article className={data?.staffing.complete ? "clear" : "warning"}><span>Staffing</span><strong>{data?.staffing.filled ?? "—"} / {data?.staffing.required ?? 4}</strong><small>{data?.staffing.complete ? "Complete" : "Coverage needs attention"}</small></article><article className={data?.officerInCharge ? "clear" : "warning"}><span>Officer in charge</span><strong>{data?.officerInCharge ? displayName(data.officerInCharge) : "Not signed in"}</strong><small>Current shift command</small></article><article className={`active-call-summary ${activeCall ? "active" : "clear"}`}><span>{data?.activeCalls.length ? `Active call${data.activeCalls.length > 1 ? ` · ${data.activeCalls.length} total` : ""}` : "Active call"}</span>{activeCall ? <><strong>{activeCall.callType}</strong><b>{activeCall.address || "Address not entered"}</b>{activeCall.narrative && <em>{activeCall.narrative}</em>}<small>{activeCall.respondingUnits || "Units pending"} · {activeCall.timeOut ? formatMilitaryTime(activeCall.timeOut) : "Time pending"}{activeCall.source ? ` · ${activeCall.source}` : ""}</small></> : <><strong>None</strong><small>No open calls</small></>}</article><article><span>Next shift change</span><strong>{next.label}</strong><small>In {next.remaining}</small></article></div>
    <div className="board-grid redesigned"><ChiefBoardPanel />
      <StaffingRotation mode="board" onDuty={data?.onDuty ?? []} newMembers={data?.newMembers ?? []} />
      <section className={`board-panel equipment rotating-panel ${rotation}${rotation === "duty" && dailyChecksNeedAttention ? " daily-check-alert" : ""}`} aria-live="polite">
        <header>
          <h2>{rotation === "equipment" ? "Equipment issues" : rotation === "duty" ? dailyFleetChecks.length ? "Daily vehicle checks" : "Current daily duty" : rotation === "news" ? "Firefighter Close Calls" : rotation === "fatalities" ? "U.S. Firefighter Line-of-Duty Deaths" : trainingProviders[rotation].name}</h2>
          <span>{rotation === "equipment" ? `${data?.equipmentIssues.length ?? 0} reported` : rotation === "duty" ? dailyFleetChecks.length ? dailyCheckUrgency === "overdue" ? "OVERDUE · Due by 7:00 AM" : dailyCheckUrgency === "due_soon" ? "DUE WITHIN 1 HOUR · 7:00 AM" : "Scheduled · Due by 7:00 AM" : `${clock.toLocaleDateString("en-US", { timeZone: "America/Chicago", weekday: "long" })} · ${shiftLabel(currentDuty?.shiftKey ?? data?.currentShift ?? "night")}` : rotation === "news" ? "Newest 3 · updates automatically" : rotation === "fatalities" ? "USFA · latest 5" : "Upcoming classes · official links"}</span>
        </header>
        <div className="rotation-content">
          <div className="rotation-slide" hidden={rotation !== "equipment"}>{data?.equipmentIssues.length ? data.equipmentIssues.map((issue) => <article key={issue.id || issue.item}><b>{issue.item}</b><strong>{issue.status}</strong><p>{issue.detail || "No details entered"}</p></article>) : <p className="board-empty clear">✓ No equipment issues reported</p>}</div>
          <div className="rotation-slide" hidden={rotation !== "duty"}>{dailyFleetChecks.length || currentDuty ? <article className={`current-duty-card${dailyChecksNeedAttention ? " daily-check-alert" : ""}`}><span>{dailyFleetChecks.length ? dailyCheckUrgency === "overdue" ? "OVERDUE" : dailyCheckUrgency === "due_soon" ? "DUE WITHIN 1 HOUR" : "DAILY CHECKS" : "NOW"}</span><b>{dailyFleetChecks.length ? "Fleet daily vehicle checks" : `${currentDuty?.shiftKey[0].toUpperCase()}${currentDuty?.shiftKey.slice(1)} duty`}</b>{currentDuty?.duty ? <p>{currentDuty.duty}</p> : dailyFleetChecks.length ? <p>Complete each vehicle check in Fleet. Finished checks clear from this board automatically.</p> : null}{dailyFleetChecks.length ? <div className="board-duty-checks daily">{dailyFleetChecks.map((check) => <a key={check.apparatusId} href={`/inventory?apparatus=${encodeURIComponent(check.apparatusId)}&check=daily`}><b>{check.unit}</b><span>{check.status === "in_progress" ? "↻ Resume daily check" : "Start daily check"} · Due by 7:00 AM</span></a>)}</div> : null}{activeWeeklyChecks.length ? <div className="board-duty-checks">{activeWeeklyChecks.map((check) => <a key={check.apparatusId} href={`/inventory?apparatus=${encodeURIComponent(check.apparatusId)}&check=weekly`}><b>{check.unit}</b><span>{check.status === "in_progress" ? "↻ Weekly check in progress" : "Weekly check pending"}</span></a>)}</div> : weeklyChecksCompleted ? <p className="board-duty-complete">✓ Today&apos;s scheduled weekly vehicle checks are completed.</p> : null}</article> : <p className="board-empty">No duty is entered for the current shift.</p>}</div>
          <div className="rotation-slide" hidden={rotation !== "news"}>{news.length ? <div className="close-call-list">{news.map((report) => <a href={report.url} target="_blank" rel="noreferrer" key={report.url} aria-label={`${report.title}. Open the full Firefighter Close Calls report.`}><time><span>Posted</span>{new Date(report.publishedAt).toLocaleDateString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", year: "numeric" })}</time><div><span className="close-call-kicker">Incident report</span><strong>{report.title}</strong>{report.excerpt && <p>{report.excerpt}</p>}<small>Read the complete report <b aria-hidden="true">↗</b></small></div></a>)}</div> : <p className="board-empty">Latest reports are temporarily unavailable.</p>}</div>
          <div className="rotation-slide" hidden={rotation !== "fatalities"}>{fatalities ? <div className="fatality-board"><div className="fatality-total"><strong>{fatalities.total}</strong><div><b>firefighter deaths in {fatalities.year}</b><span>{fatalities.stale ? "Last confirmed USFA data" : "Current USFA reported total"}</span></div></div><div className="fatality-list">{fatalities.items.map((person) => <a href={person.url} target="_blank" rel="noreferrer" key={person.id}><time>{new Date(person.deathDate).toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric" })}</time><div><strong>{person.name}</strong><span>{person.department}</span><small>{person.location}</small></div><b aria-hidden="true">↗</b></a>)}</div><p className="fatality-source">Provisional on-duty fatality information from the U.S. Fire Administration.</p></div> : <p className="board-empty">USFA fatality information is temporarily unavailable.</p>}</div>
          {(["romeoville", "ifsi", "nipsta"] as const).map((providerId) => <div className="rotation-slide" hidden={rotation !== providerId} key={providerId}><TrainingCourses provider={trainingProviders[providerId]} today={today} /></div>)}
        </div>
      </section></div>
    <section className="board-panel apparatus apparatus-wide"><header><h2>Apparatus status</h2><span>Fleet + active CAD calls</span></header><div>{data?.apparatus.map((unit) => <article className={unit.status === "Committed to call" ? "committed" : unit.status === "Available" ? "available" : "unknown"} key={unit.unit}><b>Unit {unit.unit}</b><span>{unit.status}</span></article>)}</div><p className="board-source-note">Fleet status with active CAD commitment shown in red.</p></section>
  </section>;
}
