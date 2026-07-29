"use client";
/* eslint-disable @next/next/no-img-element -- preplan photos are protected runtime records. */

import { useCallback, useEffect, useMemo, useState } from "react";

type Point = { lat: number; lng: number };
type Feature = { id:string; featureType:string; label:string; latitude:number; longitude:number; systemType:string; serviceStatus:string; details:string };
type Photo = { id:string; side:string; caption:string; url:string };
type Preplan = {
  id:string; businessName:string; address:string; latitude:number; longitude:number; aSideLatitude?:number|null; aSideLongitude?:number|null;
  footprint:Point[]; footprintSquareFeet:number; floorCount:number; constructionType:string; suggestedFireFlowGpm:number; suggestedFireFlowDuration:number;
  contactInfo:string; construction:string; accessInfo:string; alarmSystem:string; knoxBox:string; riser:string; fdc:string; sprinklerSystem:string;
  status:string; updatedAt:string; features:Feature[]; photos:Photo[];
};
type ActiveCall = { reportNumber:string; callType:string; category:string; address:string; city:string; narrative:string; respondingUnits:string; longitude:number|null; latitude:number|null; dispatchedAt:string; timeOut:string; source:string; receivedAt:string };
type RespondData = {
  activeCall:ActiveCall|null; preplan:Preplan|null; match:{method:"address"|"gps";distanceFeet:number}|null;
  cadUpdates:Array<{eventType:string;status:string;receivedAt:string;narrative:string;respondingUnits:string}>; generatedAt:string;
};
type QuickItem = { id:string; label:string; summary:string; details:string; status?:string; latitude?:number; longitude?:number };
type RightView = "cad"|"footprint"|"B"|"C"|"D";

const featureLabels:Record<string,string> = {
  alarm:"Alarm",knox:"Knox Box",riser:"System Riser",fdc:"FDC",sprinkler:"Sprinkler",
  gas:"Gas Shutoff",water:"Water Shutoff",electric:"Electrical",propane:"Propane",
  elevator:"Elevator",elevator_room:"Elevator Room",standpipe:"Standpipe",access:"Access",hazard:"Hazard",
};
const featureSymbols:Record<string,string> = { alarm:"AL",knox:"K",riser:"R",fdc:"F",sprinkler:"SP",gas:"G",water:"W",electric:"E",propane:"P",elevator:"EV",elevator_room:"ER",standpipe:"ST",access:"A",hazard:"!" };

function displayTime(value:string) {
  if (!value) return "Not reported";
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" });
}
function sidePhoto(preplan:Preplan|null, side:string) {
  return preplan?.photos.find((photo) => photo.side.trim().toUpperCase() === side) ?? null;
}
function googleNavigation(call:ActiveCall) {
  const destination = call.latitude != null && call.longitude != null ? `${call.latitude},${call.longitude}` : [call.address,call.city].filter(Boolean).join(", ");
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
}
function streetViewUrl(call:ActiveCall) {
  if (call.latitude != null && call.longitude != null) return `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${call.latitude},${call.longitude}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([call.address,call.city].filter(Boolean).join(", "))}`;
}

function FootprintDiagram({ preplan, selectedId, onSelect }:{preplan:Preplan;selectedId:string;onSelect:(item:QuickItem)=>void}) {
  const points = [...preplan.footprint.map((point) => ({ latitude:point.lat, longitude:point.lng })), ...preplan.features];
  if (preplan.footprint.length < 3) return <div className="respond-empty compact"><strong>Footprint not captured</strong><span>Add the building corners in Field Preplans.</span></div>;
  const latitudes = points.map((point) => Number(point.latitude)), longitudes = points.map((point) => Number(point.longitude));
  const minLat = Math.min(...latitudes), maxLat = Math.max(...latitudes), minLng = Math.min(...longitudes), maxLng = Math.max(...longitudes);
  const latRange = Math.max(maxLat - minLat, .00001), lngRange = Math.max(maxLng - minLng, .00001);
  const project = (latitude:number,longitude:number) => ({ x:8 + ((longitude-minLng)/lngRange)*84, y:92 - ((latitude-minLat)/latRange)*84 });
  const polygon = preplan.footprint.map((point) => { const p=project(point.lat,point.lng); return `${p.x},${p.y}`; }).join(" ");
  return <div className="respond-footprint">
    <svg viewBox="0 0 100 100" role="img" aria-label="Building footprint and mapped fire protection features">
      <path d="M92 14 L92 4 L88 9 Z" className="north-arrow"/><text x="92" y="3" textAnchor="middle">N</text>
      <polygon points={polygon}/>
      {preplan.features.map((feature) => { const p=project(feature.latitude,feature.longitude); return <g key={feature.id} className={selectedId===feature.id?"selected":""} onClick={() => onSelect({id:feature.id,label:feature.label||featureLabels[feature.featureType]||feature.featureType,summary:feature.systemType||featureLabels[feature.featureType]||feature.featureType,details:feature.details,status:feature.serviceStatus,latitude:feature.latitude,longitude:feature.longitude})}>
        <circle cx={p.x} cy={p.y} r="5"/><text x={p.x} y={p.y+1.4} textAnchor="middle">{featureSymbols[feature.featureType]||"•"}</text>
      </g>; })}
    </svg>
    <small>Tap a symbol for its quick location and system details.</small>
  </div>;
}

export default function Respond() {
  const [data,setData]=useState<RespondData|null>(null), [error,setError]=useState(""), [view,setView]=useState<RightView>("cad"), [selected,setSelected]=useState<QuickItem|null>(null);
  const [mapsKey,setMapsKey]=useState("");
  const load=useCallback(async()=>{
    try{const response=await fetch("/api/respond",{cache:"no-store"});const body=await response.json() as RespondData&{error?:string};if(!response.ok)throw new Error(body.error||"Unable to load Respond.");setData(body);setError("");}
    catch(value){setError(value instanceof Error?value.message:"Unable to load Respond.");}
  },[]);
  useEffect(()=>{const initial=window.setTimeout(()=>void load(),0);const timer=window.setInterval(()=>void load(),10000);return()=>{window.clearTimeout(initial);window.clearInterval(timer);};},[load]);
  useEffect(()=>{void fetch("/api/maps-config",{cache:"no-store"}).then((response)=>response.json()).then((body:{configured?:boolean;apiKey?:string})=>{if(body.configured&&body.apiKey)setMapsKey(body.apiKey);}).catch(()=>{});},[]);
  const quickItems=useMemo<QuickItem[]>(()=>{
    const plan=data?.preplan;if(!plan)return[];
    const staticItems=[
      ["knox","Knox Box",plan.knoxBox],["alarm","Alarm System",plan.alarmSystem],["riser","System Riser",plan.riser],
      ["fdc","FDC",plan.fdc],["sprinkler","Sprinkler System",plan.sprinklerSystem],["access","Access / Concerns",plan.accessInfo],
      ["construction","Building Construction",plan.construction],["contact","Contact",plan.contactInfo],
    ].filter((item)=>item[2]).map(([id,label,value])=>({id:`summary-${id}`,label,summary:value,details:value}));
    const mapped=plan.features.map((feature)=>({id:feature.id,label:feature.label||featureLabels[feature.featureType]||feature.featureType,summary:feature.systemType||featureLabels[feature.featureType]||feature.featureType,details:feature.details,status:feature.serviceStatus,latitude:feature.latitude,longitude:feature.longitude}));
    return [...mapped,...staticItems];
  },[data?.preplan]);
  const call=data?.activeCall??null, plan=data?.preplan??null, alpha=sidePhoto(plan,"A"), selectedSide=view==="B"||view==="C"||view==="D"?sidePhoto(plan,view):null;
  const streetLocation=call ? (call.latitude!=null&&call.longitude!=null?`${call.latitude},${call.longitude}`:[call.address,call.city].filter(Boolean).join(", ")) : "";
  const streetEmbed=mapsKey&&streetLocation?`https://www.google.com/maps/embed/v1/streetview?key=${encodeURIComponent(mapsKey)}&location=${encodeURIComponent(streetLocation)}&fov=90&heading=0&pitch=0`:"";
  if(!data&&!error)return <section className="respond-page"><div className="respond-empty"><strong>Loading active response…</strong><span>Checking current CAD and preplan records.</span></div></section>;
  if(error&&!data)return <section className="respond-page"><div className="respond-empty danger"><strong>Respond could not load</strong><span>{error}</span><button onClick={()=>void load()}>Try again</button></div></section>;
  if(!call)return <section className="respond-page"><header className="respond-title"><div><span>FIELD · RESPOND</span><h1>Response Workspace</h1></div><small>Checks every 10 seconds</small></header><div className="respond-empty"><strong>No active call</strong><span>When a CAD call or open Daily Log call is active, its incident and matched preplan will appear here automatically.</span></div></section>;
  return <section className="respond-page">
    <header className="respond-callbar">
      <div><span>ACTIVE CALL · {call.source||"CAD"}</span><h1>{call.callType||call.category||"Call type not reported"}</h1><p>{[call.address,call.city].filter(Boolean).join(", ")||"Address not reported"}</p></div>
      <dl><div><dt>Call #</dt><dd>{call.reportNumber||"Pending"}</dd></div><div><dt>Time out</dt><dd>{displayTime(call.timeOut||call.dispatchedAt)}</dd></div><div><dt>Units</dt><dd>{call.respondingUnits||"Not reported"}</dd></div></dl>
      <a className="respond-nav" href={googleNavigation(call)} target="_blank" rel="noreferrer" data-test-safe>Open Google Navigation ↗</a>
    </header>
    <div className="respond-statusline"><span className={plan?"matched":"unmatched"}>{plan?`Preplan matched by ${data?.match?.method}${data?.match?.method==="gps"?` · ${data.match.distanceFeet} ft`:""}`:"No matching preplan"}</span><span>Updated {displayTime(data?.generatedAt||"")}</span>{error&&<span className="warning">{error}</span>}</div>
    <div className="respond-grid">
      <aside className="respond-intel"><header><span>BUILDING INTELLIGENCE</span><h2>{plan?.businessName||"No preplan found"}</h2><p>{plan?.address||"Use the active-call address while en route."}</p></header>
        {plan&&<div className="respond-building-stats"><span>{Math.round(plan.footprintSquareFeet||0).toLocaleString()} sq ft</span><span>{plan.floorCount||1} floor{plan.floorCount===1?"":"s"}</span>{plan.suggestedFireFlowGpm>0&&<span>{Math.round(plan.suggestedFireFlowGpm).toLocaleString()} GPM suggested</span>}</div>}
        <div className="respond-intel-list">{quickItems.map((item)=><button key={item.id} className={selected?.id===item.id?"selected":""} onClick={()=>setSelected(item)} data-test-safe><span className="feature-symbol">{featureSymbols[item.id.replace("summary-","")]||featureSymbols[plan?.features.find((feature)=>feature.id===item.id)?.featureType||""]||"i"}</span><span><strong>{item.label}</strong><small>{item.summary||"Details available"}</small></span><b>›</b></button>)}</div>
        {!quickItems.length&&<div className="respond-empty compact"><strong>No building systems entered</strong><span>Add them in Field Preplans.</span></div>}
      </aside>
      <main className="respond-alpha"><header><div><span>PRIMARY VIEW</span><h2>{alpha?"Alpha / A Side":"Street View Fallback"}</h2></div>{plan&&<span className="record-badge">{plan.status}</span>}</header>
        <div className="respond-primary-media">{alpha?<img src={alpha.url} alt={alpha.caption||`Alpha side of ${plan?.businessName||call.address}`}/>:streetEmbed?<iframe title={`Street View near ${call.address}`} src={streetEmbed} loading="lazy" referrerPolicy="no-referrer-when-downgrade" allowFullScreen/>:<div className="respond-empty overlay"><strong>No Alpha photo is saved</strong><span>Open Street View for the active-call location.</span><a href={streetViewUrl(call)} target="_blank" rel="noreferrer" data-test-safe>Open Street View ↗</a></div>}</div>
        <footer><strong>{alpha?.caption||plan?.businessName||call.address}</strong><span>{alpha?"Approved preplan photo":"Fallback based on the dispatch address or GPS location"}</span></footer>
      </main>
      <aside className="respond-context"><nav>{(["cad","footprint","B","C","D"] as RightView[]).map((item)=><button key={item} className={view===item?"active":""} onClick={()=>setView(item)} data-test-safe>{item==="cad"?"CAD Notes":item==="footprint"?"Footprint":`${item} Side`}</button>)}</nav>
        <div className="respond-context-body">
          {view==="cad"&&<><header><span>LIVE CAD UPDATES</span><h2>Dispatch Notes</h2></header>{data?.cadUpdates.length?data.cadUpdates.map((update,index)=><article className="cad-update" key={`${update.receivedAt}-${index}`}><div><strong>{update.eventType||"CAD update"}</strong><time>{displayTime(update.receivedAt)}</time></div>{update.narrative&&<p>{update.narrative}</p>}{update.respondingUnits&&<small>Units: {update.respondingUnits}</small>}</article>):<div className="respond-empty compact"><strong>No CAD narrative received</strong><span>The incident header will still refresh automatically.</span></div>}</>}
          {view==="footprint"&&(plan?<><header><span>TACTICAL MAP</span><h2>Footprint + Systems</h2></header><FootprintDiagram preplan={plan} selectedId={selected?.id||""} onSelect={setSelected}/></>:<div className="respond-empty compact"><strong>No footprint available</strong><span>No preplan matched this active call.</span></div>)}
          {(view==="B"||view==="C"||view==="D")&&(selectedSide?<div className="respond-side-photo"><img src={selectedSide.url} alt={selectedSide.caption||`${view} side`}/><strong>{selectedSide.caption||`${view} Side`}</strong></div>:<div className="respond-empty compact"><strong>{view} Side photo required</strong><span>Add the exterior photo in Field Preplans.</span></div>)}
        </div>
      </aside>
    </div>
    <section className={`respond-quick ${selected?"open":""}`} aria-live="polite">{selected?<><div><span>QUICK INFORMATION</span><h2>{selected.label}</h2></div><dl><div><dt>Type / system</dt><dd>{selected.summary||"Not entered"}</dd></div><div><dt>Status</dt><dd>{selected.status?.replaceAll("_"," ")||"Not reported"}</dd></div><div><dt>Details</dt><dd>{selected.details||"No additional details entered."}</dd></div>{selected.latitude!=null&&selected.longitude!=null&&<div><dt>GPS location</dt><dd>{selected.latitude.toFixed(6)}, {selected.longitude.toFixed(6)} · <a href={`https://www.google.com/maps/search/?api=1&query=${selected.latitude},${selected.longitude}`} target="_blank" rel="noreferrer">Open map ↗</a></dd></div>}</dl><button onClick={()=>setSelected(null)} aria-label="Close quick information" data-test-safe>×</button></>:<><strong>Select building information or a footprint symbol</strong><span>Quick location, status, and system details will appear here.</span></>}</section>
  </section>;
}
