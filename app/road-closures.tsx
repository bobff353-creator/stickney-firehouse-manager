"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import GoogleFieldMap from "./google-field-map";

type Point = { lat: number; lng: number };
type RoadClosure = {
  id: string; roadName: string; reason: string; path: Point[]; detourPoint: Point;
  status: "active" | "cleared"; startedAt: string; expectedClearAt: string | null;
  createdBy: string; clearedBy: string | null; clearedAt: string | null; clearNote: string;
};

const stickney = { lat: 41.8189, lng: -87.7734 };
function world(point: Point, zoom: number) { const scale = 256 * 2 ** zoom; return { x: (point.lng + 180) / 360 * scale, y: (1 - Math.asinh(Math.tan(point.lat * Math.PI / 180)) / Math.PI) / 2 * scale }; }
function project(point: Point, center: Point, zoom: number, width: number, height: number) { const p = world(point, zoom), c = world(center, zoom); return { x: width / 2 + p.x - c.x, y: height / 2 + p.y - c.y }; }
function unproject(x: number, y: number, center: Point, zoom: number, width: number, height: number): Point { const scale = 256 * 2 ** zoom, c = world(center, zoom), wx = c.x + x - width / 2, wy = c.y + y - height / 2; return { lng: wx / scale * 360 - 180, lat: Math.atan(Math.sinh(Math.PI * (1 - 2 * wy / scale))) * 180 / Math.PI }; }
function points(value: Point[], center: Point, zoom: number, width: number, height: number) { return value.map((point) => { const p = project(point, center, zoom, width, height); return `${p.x},${p.y}`; }).join(" "); }
function dateTime(value: string | null) { return value ? new Date(value).toLocaleString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "Until reopened"; }
export function roadClosureDetourUrl(closure: Pick<RoadClosure, "path" | "detourPoint">) {
  const destination = closure.path.at(-1);
  if (!destination) return "https://www.google.com/maps";
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${destination.lat},${destination.lng}`)}&waypoints=${encodeURIComponent(`${closure.detourPoint.lat},${closure.detourPoint.lng}`)}&travelmode=driving`;
}

function ClosureMap({ apiKey, closures, draft, detourPoint, mode, center, zoom, onCenter, onZoom, onClick }:{ apiKey:string; closures:RoadClosure[]; draft:Point[]; detourPoint:Point|null; mode:"trace"|"detour"|""; center:Point; zoom:number; onCenter:(point:Point)=>void; onZoom:(zoom:number)=>void; onClick:(point:Point)=>void }) {
  const root = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 1000, height: 600 });
  useEffect(() => { const element = root.current; if (!element) return; const update = () => { const rect = element.getBoundingClientRect(); if (rect.width && rect.height) setSize({ width: rect.width, height: rect.height }); }; update(); const observer = new ResizeObserver(update); observer.observe(element); return () => observer.disconnect(); }, []);
  return <div ref={root} className={`road-closure-map${mode ? " capture" : ""}`}>
    {apiKey && <GoogleFieldMap apiKey={apiKey} center={center} zoom={zoom} imagery="street" interactive={!mode} onReady={() => {}} onViewChange={(next, nextZoom) => { onCenter(next); onZoom(nextZoom); }} />}
    <svg viewBox={`0 0 ${size.width} ${size.height}`} preserveAspectRatio="none" aria-label="Active road closure map overlay">
      {closures.filter((item) => item.status === "active").map((closure) => <g key={closure.id}><polyline className="active-road-closure" points={points(closure.path, center, zoom, size.width, size.height)} />{closure.path.slice(0, 1).map((point) => { const p = project(point, center, zoom, size.width, size.height); return <text className="road-closure-label" x={p.x + 10} y={p.y - 10} key={closure.id}>{closure.roadName} · OOS</text>; })}</g>)}
      {draft.length > 0 && <polyline className="draft-road-closure" points={points(draft, center, zoom, size.width, size.height)} />}
      {draft.map((point, index) => { const p = project(point, center, zoom, size.width, size.height); return <g key={index}><circle className="road-trace-point" cx={p.x} cy={p.y} r="9"/><text className="road-trace-number" x={p.x} y={p.y + 4}>{index + 1}</text></g>; })}
      {detourPoint && (() => { const p = project(detourPoint, center, zoom, size.width, size.height); return <g><circle className="road-detour-point" cx={p.x} cy={p.y} r="13"/><text className="road-detour-label" x={p.x + 17} y={p.y + 5}>BYPASS</text></g>; })()}
    </svg>
    {mode && <button type="button" className="road-map-capture" aria-label={mode === "trace" ? "Add point to closed road trace" : "Set preferred bypass point"} onClick={(event) => { const rect = event.currentTarget.getBoundingClientRect(); onClick(unproject(event.clientX - rect.left, event.clientY - rect.top, center, zoom, size.width, size.height)); }} />}
    <div className="road-map-status">{mode === "trace" ? "Tap points in order along the closed road" : mode === "detour" ? "Tap one safe point on the preferred bypass" : `${closures.filter((item) => item.status === "active").length} active closure${closures.filter((item) => item.status === "active").length === 1 ? "" : "s"}`}</div>
  </div>;
}

export default function RoadClosures() {
  const [closures, setClosures] = useState<RoadClosure[]>([]), [canManage, setCanManage] = useState(false), [mapsApiKey, setMapsApiKey] = useState("");
  const [center, setCenter] = useState<Point>(stickney), [zoom, setZoom] = useState(17), [mode, setMode] = useState<"trace"|"detour"|"">("");
  const [roadName, setRoadName] = useState(""), [reason, setReason] = useState(""), [expectedClearAt, setExpectedClearAt] = useState(""), [path, setPath] = useState<Point[]>([]), [detourPoint, setDetourPoint] = useState<Point|null>(null);
  const [message, setMessage] = useState(""), [busy, setBusy] = useState(false), [showHistory, setShowHistory] = useState(false);
  const active = closures.filter((item) => item.status === "active");
  const load = useCallback(async () => { const response = await fetch("/api/road-closures", { cache: "no-store" }); const body = await response.json() as { closures?:RoadClosure[];canManage?:boolean;error?:string }; if (!response.ok) throw new Error(body.error || "Unable to load road closures"); setClosures(body.closures || []); setCanManage(Boolean(body.canManage)); }, []);
  useEffect(() => { const timer=window.setTimeout(()=>{void load().catch((error) => setMessage(error instanceof Error ? error.message : "Unable to load road closures"));void fetch("/api/maps-config", { cache: "no-store" }).then((response) => response.json()).then((body:{apiKey?:string}) => setMapsApiKey(body.apiKey || "")).catch(() => {});},0);return()=>window.clearTimeout(timer); }, [load]);
  function mapClick(point: Point) { if (mode === "trace") setPath((current) => [...current, point].slice(0, 80)); else if (mode === "detour") { setDetourPoint(point); setMode(""); } }
  async function save() { setBusy(true); setMessage(""); try { const response = await fetch("/api/road-closures", { method:"POST", headers:{ "content-type":"application/json" }, body:JSON.stringify({ action:"create", roadName, reason, expectedClearAt, path, detourPoint }) }); const body = await response.json() as {closures?:RoadClosure[];error?:string}; if (!response.ok) throw new Error(body.error || "Unable to activate road closure"); setClosures(body.closures || []); setRoadName("");setReason("");setExpectedClearAt("");setPath([]);setDetourPoint(null);setMode("");setMessage("Road closure is active and now appears on Live Operations."); } catch(error) { setMessage(error instanceof Error ? error.message : "Unable to activate road closure"); } finally { setBusy(false); } }
  async function clearClosure(id:string) { const clearNote = window.prompt("Reopening note (optional)", "Road reopened") ?? null; if (clearNote === null) return; setBusy(true); try { const response=await fetch("/api/road-closures",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"clear",id,clearNote})});const body=await response.json() as {closures?:RoadClosure[];error?:string};if(!response.ok)throw new Error(body.error||"Unable to reopen road");setClosures(body.closures||[]);setMessage("Road reopened. The Live Operations warning has cleared."); } catch(error){setMessage(error instanceof Error?error.message:"Unable to reopen road");} finally{setBusy(false);} }
  return <section className="road-closures-page">
    <header className="road-closures-hero"><div><span>FIELD · OPERATIONAL ROUTING</span><h1>Road Closures</h1><p>Trace a road that is out of service, choose the department bypass, and keep crews and Live Operations informed until it reopens.</p></div><strong className={active.length ? "has-closures" : "clear"}>{active.length} ACTIVE</strong></header>
    {message && <div className="road-closure-message" role="status">{message}</div>}
    <div className="road-closure-layout">
      <div><div className="road-map-toolbar"><button className={mode==="trace"?"active":""} disabled={!canManage} onClick={()=>setMode(mode==="trace"?"":"trace")}>1. Trace closed road</button><button className={mode==="detour"?"active":""} disabled={!canManage} onClick={()=>setMode(mode==="detour"?"":"detour")}>2. Set bypass point</button><button disabled={!path.length} onClick={()=>setPath((current)=>current.slice(0,-1))}>Undo point</button><button disabled={!path.length&&!detourPoint} onClick={()=>{setPath([]);setDetourPoint(null);setMode("");}}>Clear drawing</button><span/><button onClick={()=>setZoom(Math.max(14,zoom-1))}>−</button><b>Zoom {zoom}</b><button onClick={()=>setZoom(Math.min(21,zoom+1))}>+</button></div><ClosureMap apiKey={mapsApiKey} closures={active} draft={path} detourPoint={detourPoint} mode={mode} center={center} zoom={zoom} onCenter={setCenter} onZoom={setZoom} onClick={mapClick}/></div>
      <aside>
        {canManage ? <section className="road-closure-form"><span>CREATE CLOSURE</span><h2>Activate road out of service</h2><label>Road name<input value={roadName} onChange={(event)=>setRoadName(event.target.value)} placeholder="Example: 39th Street at Oak Park Ave"/></label><label>Reason<textarea value={reason} onChange={(event)=>setReason(event.target.value)} placeholder="Construction, fireground operations, flooding, wires down…"/></label><label>Expected reopening (optional)<input type="datetime-local" value={expectedClearAt} onChange={(event)=>setExpectedClearAt(event.target.value)}/></label><ol><li className={path.length>=2?"done":""}>Trace at least two road points</li><li className={detourPoint?"done":""}>Set the preferred bypass point</li></ol><button className="activate-road-closure" disabled={busy||!roadName.trim()||path.length<2||!detourPoint} onClick={()=>void save()}>{busy?"Saving…":"Activate closure"}</button><small>Google Maps cannot accept a private exact-road exclusion. The crew link routes through your selected bypass point.</small></section> : <section className="road-closure-form"><h2>View only</h2><p>An officer or administrator with Incident Command permission can activate and clear closures.</p></section>}
      </aside>
    </div>
    <section className="active-road-list"><header><div><span>LIVE OPERATIONS</span><h2>Active road closures</h2></div><b>{active.length}</b></header>{active.length ? active.map((closure)=><article key={closure.id}><div><span>ROAD OUT OF SERVICE</span><h3>{closure.roadName}</h3><p>{closure.reason||"No reason entered."}</p><small>Active since {dateTime(closure.startedAt)} · Expected clear: {dateTime(closure.expectedClearAt)}</small></div><div><a href={roadClosureDetourUrl(closure)} target="_blank" rel="noreferrer">Open department detour in Google Maps ↗</a>{canManage&&<button disabled={busy} onClick={()=>void clearClosure(closure.id)}>Mark road reopened</button>}</div></article>) : <p className="road-closure-empty">No roads are currently marked out of service.</p>}</section>
    <button className="road-history-toggle" onClick={()=>setShowHistory((value)=>!value)}>{showHistory?"Hide":"Show"} closure history ({closures.length-active.length})</button>{showHistory&&<section className="road-closure-history">{closures.filter((item)=>item.status==="cleared").map((closure)=><article key={closure.id}><b>{closure.roadName}</b><span>Reopened {dateTime(closure.clearedAt)} by {closure.clearedBy||"Department"}</span><small>{closure.clearNote}</small></article>)}</section>}
  </section>;
}
