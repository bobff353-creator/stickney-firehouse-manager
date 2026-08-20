"use client";

import { useEffect, useMemo, useState } from "react";
import { cachePublishedPreplan, getCachedPublishedPreplan } from "./offline-cache";
import { isOperationallyVisible, lifecycleState } from "./domain";

type Row = Record<string, unknown> & { id:string; archived?:number; levelId?:string; spaceId?:string };
type OperationalPayload = { plan?:Row;levels:Row[];spaces:Row[];alerts:Row[];hazmat:Row[];zones:Row[];annotations:Row[];assets:Row[];hoseLays:Row[];risks:Row[];reviews:Row[];revisions:Row[] };
const empty:OperationalPayload={levels:[],spaces:[],alerts:[],hazmat:[],zones:[],annotations:[],assets:[],hoseLays:[],risks:[],reviews:[],revisions:[]};

function label(value:unknown,fallback="Not entered"){const result=String(value??"").trim();return result||fallback;}
function date(value:unknown){const parsed=new Date(String(value??""));return Number.isFinite(parsed.getTime())?parsed.toLocaleString():"Not set";}

export default function OperationalPreplanPanel({preplanId,canEdit=false}:{preplanId:string;canEdit?:boolean}){
  const [data,setData]=useState<OperationalPayload>(empty);
  const [source,setSource]=useState<"loading"|"live"|"offline"|"unavailable">("loading");
  const [cachedAt,setCachedAt]=useState("");
  const [selectedLevel,setSelectedLevel]=useState("");
  const [reloadKey,setReloadKey]=useState(0),[editor,setEditor]=useState<""|"level"|"space"|"alert"|"hazmat">(""),[saving,setSaving]=useState(false),[saveError,setSaveError]=useState("");
  const blankForm={name:"",shortLabel:"",aliases:"",severity:"warning",title:"",message:"",effectiveAt:"",expiresAt:"",materialName:"",unNumber:"",ergGuideNumber:"",quantity:"",quantityUnit:"",storageType:""};
  const [form,setForm]=useState<Record<string,string>>(blankForm);
  useEffect(()=>{
    let active=true;
    async function load(){
      try{
        const response=await fetch(`/api/field-preplans/operational?preplanId=${encodeURIComponent(preplanId)}`,{cache:"no-store"});
        if(!response.ok)throw new Error("Operational record unavailable");
        const payload=await response.json() as OperationalPayload;
        if(!active)return;
        setData(payload);setSource("live");
        const revision=Number(payload.revisions[0]?.revisionNumber??0);
        const now=new Date().toISOString();setCachedAt(now);
        if(payload.plan?.publicationStatus==="published")await cachePublishedPreplan({id:preplanId,revision,cachedAt:now,payload});
      }catch{
        try{
          const cached=await getCachedPublishedPreplan<OperationalPayload>(preplanId);
          if(!active)return;
          if(cached){setData(cached.payload);setCachedAt(cached.cachedAt);setSource("offline");}
          else setSource("unavailable");
        }catch{if(active)setSource("unavailable");}
      }
    }
    void load();return()=>{active=false};
  },[preplanId,reloadKey]);
  async function save(){
    setSaving(true);setSaveError("");
    try{
      const actions={level:"saveLevel",space:"saveSpace",alert:"saveAlert",hazmat:"saveHazmat"} as const;
      if(!editor)return;
      const payload:Record<string,unknown>={action:actions[editor],preplanId,levelId:levelId||undefined,...form,quantity:form.quantity?Number(form.quantity):undefined};
      if(editor==="space")payload.aliases=form.aliases.split(",").map((item)=>item.trim()).filter(Boolean);
      const response=await fetch("/api/field-preplans/operational",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(payload)});
      const body=await response.json() as {error?:string};if(!response.ok)throw new Error(body.error||"Unable to save operational record.");
      setEditor("");setForm(blankForm);setReloadKey((value)=>value+1);
    }catch(error){setSaveError(error instanceof Error?error.message:"Unable to save operational record.");}finally{setSaving(false);}
  }
  async function transition(action:"submitReview"|"returnDraft"|"publish"|"archive"){
    setSaving(true);setSaveError("");
    try{const response=await fetch("/api/field-preplans/operational",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action,preplanId,comment:`${action} from Field Preplans`})});const body=await response.json() as {error?:string};if(!response.ok)throw new Error(body.error||"Unable to update publication status.");setReloadKey((value)=>value+1);}
    catch(error){setSaveError(error instanceof Error?error.message:"Unable to update publication status.");}finally{setSaving(false);}
  }
  const levels=useMemo(()=>data.levels.filter((item)=>!item.archived),[data.levels]);
  const levelId=selectedLevel||String(levels.find((item)=>item.isDefault)?.id??levels[0]?.id??"");
  const spaces=data.spaces.filter((item)=>!item.archived&&(!levelId||item.levelId===levelId));
  const alerts=data.alerts.filter((item)=>!item.archived&&isOperationallyVisible({effectiveAt:item.effectiveAt as string,expiresAt:item.expiresAt as string,expirationAction:item.expirationAction as never})&&(!item.levelId||!levelId||item.levelId===levelId));
  const hazards=data.hazmat.filter((item)=>!item.archived&&isOperationallyVisible({effectiveAt:item.effectiveAt as string,expiresAt:item.expiresAt as string})&&(!item.levelId||!levelId||item.levelId===levelId));
  const hoseLays=data.hoseLays.filter((item)=>!item.archived&&(!item.levelId||!levelId||item.levelId===levelId));
  if(source==="loading")return <section className="operational-preplan-panel" aria-busy="true"><h3>Operational intelligence</h3><p>Loading published response details…</p></section>;
  if(source==="unavailable")return <section className="operational-preplan-panel"><h3>Operational intelligence</h3><p>The operational 2.0 record is not available yet. The approved legacy preplan above remains usable.</p></section>;
  return <section className="operational-preplan-panel" aria-label="Operational preplan intelligence">
    <header><div><span>PREPLAN 2.0 · {label(data.plan?.publicationStatus,"LEGACY").toUpperCase()}</span><h3>Operational intelligence</h3></div><div className={`operational-cache-state ${source}`}>{source==="offline"?"OFFLINE CACHED":data.plan?.publicationStatus==="published"?"LIVE PUBLISHED":"LIVE WORKING COPY"}<small>{cachedAt?date(cachedAt):""}</small></div></header>
    {canEdit&&<div className="operational-publication-actions"><strong>Publication workflow</strong><button disabled={saving} onClick={()=>void transition("returnDraft")}>Return to draft</button><button disabled={saving} onClick={()=>void transition("submitReview")}>Submit for review</button><button className="publish" disabled={saving} onClick={()=>void transition("publish")}>Publish revision</button><button disabled={saving} onClick={()=>void transition("archive")}>Archive</button></div>}
    {levels.length>0&&<nav aria-label="Building level"><label>Level<select value={levelId} onChange={(event)=>setSelectedLevel(event.target.value)}>{levels.map((level)=><option key={level.id} value={level.id}>{label(level.name)}</option>)}</select></label></nav>}
    {canEdit&&<div className="operational-editor-actions"><span>Add verified operational data</span>{([['level','Level'],['space','Room / area'],['alert','Response alert'],['hazmat','HazMat']] as const).map(([key,name])=><button type="button" className={editor===key?"active":""} key={key} onClick={()=>{setEditor(editor===key?"":key);setSaveError("");}}>+ {name}</button>)}</div>}
    {editor&&<form className="operational-inline-editor" onSubmit={(event)=>{event.preventDefault();void save();}}><header><strong>{editor==="level"?"Add building level":editor==="space"?"Add room or operational area":editor==="alert"?"Add time-aware response alert":"Add HazMat inventory"}</strong><button type="button" onClick={()=>setEditor("")} aria-label="Close editor">×</button></header>
      {editor==="level"&&<><label>Level name<input required value={form.name} onChange={(event)=>setForm({...form,name:event.target.value})} placeholder="Example: Basement 1"/></label><label>Short label<input value={form.shortLabel} onChange={(event)=>setForm({...form,shortLabel:event.target.value})} placeholder="Generated if blank"/></label></>}
      {editor==="space"&&<><label>Room / area name<input required value={form.name} onChange={(event)=>setForm({...form,name:event.target.value})} placeholder="Example: Electrical Room"/></label><label>CAD aliases<input value={form.aliases} onChange={(event)=>setForm({...form,aliases:event.target.value})} placeholder="Comma-separated dispatch names"/></label></>}
      {editor==="alert"&&<><label>Severity<select value={form.severity} onChange={(event)=>setForm({...form,severity:event.target.value})}><option value="informational">Informational</option><option value="caution">Caution</option><option value="warning">Warning</option><option value="critical">Critical</option></select></label><label>Alert title<input required value={form.title} onChange={(event)=>setForm({...form,title:event.target.value})}/></label><label className="wide">Crew message<textarea required value={form.message} onChange={(event)=>setForm({...form,message:event.target.value})}/></label><label>Effective at<input type="datetime-local" value={form.effectiveAt} onChange={(event)=>setForm({...form,effectiveAt:event.target.value})}/></label><label>Expires at<input type="datetime-local" value={form.expiresAt} onChange={(event)=>setForm({...form,expiresAt:event.target.value})}/></label></>}
      {editor==="hazmat"&&<><label>Material name<input required value={form.materialName} onChange={(event)=>setForm({...form,materialName:event.target.value})}/></label><label>UN / NA number<input value={form.unNumber} onChange={(event)=>setForm({...form,unNumber:event.target.value})} inputMode="numeric"/></label><label>Verified ERG guide<input value={form.ergGuideNumber} onChange={(event)=>setForm({...form,ergGuideNumber:event.target.value})}/></label><label>Quantity<input value={form.quantity} onChange={(event)=>setForm({...form,quantity:event.target.value})} inputMode="decimal"/></label><label>Unit<input value={form.quantityUnit} onChange={(event)=>setForm({...form,quantityUnit:event.target.value})} placeholder="gal, lb, cylinders"/></label><label>Storage type<input value={form.storageType} onChange={(event)=>setForm({...form,storageType:event.target.value})}/></label><small className="wide">Only enter a guide number verified against the official PHMSA ERG 2024. Leaving it blank is safer than guessing.</small></>}
      {saveError&&<p className="operational-save-error" role="alert">{saveError}</p>}<button className="primary-action" disabled={saving}>{saving?"Saving…":"Save operational record"}</button>
    </form>}
    <div className="operational-summary-grid">
      <article><span>LEVELS</span><strong>{levels.length}</strong><small>{levels.map((item)=>label(item.shortLabel)).join(" · ")||"Legacy arrival view"}</small></article>
      <article><span>ROOMS / AREAS</span><strong>{spaces.length}</strong><small>{spaces.slice(0,3).map((item)=>label(item.name)).join(" · ")||"None mapped"}</small></article>
      <article><span>REVISION</span><strong>{label(data.revisions[0]?.revisionNumber,"Legacy")}</strong><small>{label(data.revisions[0]?.publicationStatus,"Published record")}</small></article>
      <article><span>HOSE LAYS</span><strong>{hoseLays.length}</strong><small>{hoseLays[0]?`${label(hoseLays[0].recommendedHoseFeet)} ft recommended`:"None calculated"}</small></article>
    </div>
    <div className="operational-response-grid">
      <article className="operational-alerts"><h4>Response alerts</h4>{alerts.length?alerts.map((item)=>{const state=lifecycleState({effectiveAt:item.effectiveAt as string,expiresAt:item.expiresAt as string,expirationAction:item.expirationAction as never});return <section key={item.id} className={`operational-alert ${label(item.severity,"warning")} ${state}`}><div><strong>{label(item.title)}</strong><b>{label(item.severity).toUpperCase()} · {state.toUpperCase()}</b></div><p>{label(item.message)}</p>{item.expiresAt?<small>Expires {date(item.expiresAt)}</small>:null}</section>}):<p className="operational-empty">No active response alerts are recorded.</p>}</article>
      <article className="operational-hazmat"><h4>HazMat / ERG 2024</h4>{hazards.length?hazards.map((item)=><section key={item.id}><div><strong>{label(item.materialName)}</strong><b>{item.unNumber?`UN/NA ${label(item.unNumber)}`:"No UN/NA number"}</b></div><dl><div><dt>ERG guide</dt><dd>{label(item.ergGuideNumber,"Verify in official ERG")}</dd></div><div><dt>Quantity</dt><dd>{item.quantity?`${item.quantity} ${label(item.quantityUnit,"")}`:"Not entered"}</dd></div><div><dt>Storage</dt><dd>{label(item.storageType)}</dd></div></dl></section>):<p className="operational-empty">No HazMat inventory is recorded for this level.</p>}<a href="https://www.phmsa.dot.gov/training/hazmat/erg/emergency-response-guidebook-erg" target="_blank" rel="noreferrer">Open official PHMSA ERG 2024 ↗</a></article>
    </div>
  </section>;
}
