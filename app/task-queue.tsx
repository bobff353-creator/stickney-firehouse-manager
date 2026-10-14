'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { taskDueState, type QueueTask, type DueState } from './task-queue-model';
type Packet={items:QueueTask[];today:string;viewerIds:string[];privateAccess:boolean;sources:{name:string;state:string}[];generatedAt:string};
export default function TaskQueue(){
  const [packet,setPacket]=useState<Packet|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(true);
  const active=useRef<AbortController|null>(null);
  const [query,setQuery]=useState(''),[source,setSource]=useState('All'),[due,setDue]=useState('Attention'),[mine,setMine]=useState(false),[page,setPage]=useState(0);
  const load=useCallback(async(signal?:AbortSignal)=>{
    await Promise.resolve();if(signal?.aborted)return;
    active.current?.abort();const controller=new AbortController();active.current=controller;
    const requestSignal=signal?AbortSignal.any([signal,controller.signal]):controller.signal;
    setBusy(true);setError('');try{
    const response=await fetch('/api/task-queue',{cache:'no-store',signal:requestSignal}),data=await response.json();
    if(!response.ok)throw Error(data.error||'The task queue could not load.');
    if(!requestSignal.aborted){setPacket(data);setPage(0);}
  }catch(e){if(!requestSignal.aborted){setPacket(null);setError(e instanceof Error?e.message:'The task queue could not load.');}}finally{if(!requestSignal.aborted)setBusy(false);}},[]);
  useEffect(()=>{const controller=new AbortController();void Promise.resolve().then(()=>load(controller.signal));return()=>{controller.abort();active.current?.abort();};},[load]);
  const filtered=useMemo(()=>packet?.items.filter(item=>{
    const state=taskDueState(item,packet.today),needle=query.trim().toLowerCase();
    return (source==='All'||item.source===source)&&(due==='All'||due==='Attention'&&state!=='Later'||state===due)&&(!mine||item.assignedIds.some(id=>packet.viewerIds.includes(id)))&&(!needle||[item.title,item.detail,...item.assignees].join(' ').toLowerCase().includes(needle));
  })||[],[packet,query,source,due,mine]);
  const currentPage=Math.min(page,Math.max(0,Math.ceil(filtered.length/25)-1)),visible=filtered.slice(currentPage*25,currentPage*25+25);
  const choose=(fn:()=>void)=>{fn();setPage(0);};
  return <section className="connected-work task-queue" aria-label="Task queue">
    <header><div><p className="cw-eyebrow">Department work</p><h1>Task queue</h1><p>Review assigned work and recorded due dates. Open a task to update it in its original workspace.</p></div><button type="button" disabled={busy} onClick={()=>void load()}>{busy?'Loading…':'Refresh tasks'}</button></header>
    {error&&<p className="cw-notice" role="alert">{error} <button type="button" onClick={()=>void load()}>Retry</button></p>}
    {packet&&<>
      <p className="cw-caption">Loaded {new Date(packet.generatedAt).toLocaleString('en-US',{timeZone:'America/Chicago'})} · Department dates use America/Chicago.</p>
      {packet.sources.some(s=>s.state==='unavailable')&&<p className="cw-notice" role="alert">Some work could not load: {packet.sources.filter(s=>s.state==='unavailable').map(s=>s.name).join(', ')}. Counts cover the available sources only. <button type="button" disabled={busy} onClick={()=>void load()}>Retry sources</button></p>}
      {!packet.sources.length&&<p className="cw-notice">No connected task sources are available with your current access.</p>}
      <div className="cw-counts">{(['Overdue','Today','Next 30 days','Date needed','Date needs review'] as DueState[]).map(state=><button key={state} type="button" aria-pressed={due===state} onClick={()=>choose(()=>setDue(state))}><strong>{packet.items.filter(item=>taskDueState(item,packet.today)===state).length}</strong><span>{state}</span></button>)}</div>
      <div className="cw-filters"><label>Find a task<input aria-label="Find a task" type="search" value={query} onChange={e=>choose(()=>setQuery(e.target.value))} placeholder="Task, location or assigned member"/></label><label>Workspace<select aria-label="Workspace" value={source} onChange={e=>choose(()=>setSource(e.target.value))}><option>All</option>{[...new Set(packet.items.map(item=>item.source))].map(value=><option key={value}>{value}</option>)}</select></label><label>Due date<select aria-label="Due date" value={due} onChange={e=>choose(()=>setDue(e.target.value))}>{['Attention','All','Overdue','Today','Next 30 days','Later','Date needed','Date needs review'].map(value=><option key={value}>{value}</option>)}</select></label></div>
      <label className="cw-check"><input type="checkbox" checked={mine} onChange={e=>choose(()=>setMine(e.target.checked))}/>My tasks only</label>
      {mine&&<p className="cw-caption">Matches your saved member ID. Unassigned work and text-only repair assignments appear under All tasks.</p>}
      {packet.privateAccess&&<p className="cw-caption">Private training and inspection records appear only for the designated pilot owner. Credential dates are review reminders; no messages are sent and duty eligibility is unchanged.</p>}
      <p role="status">{filtered.length} matching {filtered.length===1?'task':'tasks'}{filtered.length>25?` · Showing ${currentPage*25+1}–${currentPage*25+visible.length}`:''}</p>
      <div className="cw-list">{visible.map(item=><article key={item.id}><div className="cw-row-heading"><span>{item.source} · {item.status}</span><strong className="cw-badge">{taskDueState(item,packet.today)}</strong></div><h2>{item.title}</h2>{item.detail&&<p>{item.detail}</p>}<p>Assigned: {item.assignees.join(', ')||'Not assigned'}</p><p>Recorded date: {item.dueDate||'Not recorded'}{item.invalidDate?' · Check the source date':''}</p><a className="cw-link" href={item.href}>Open {item.source==='Credentials'?'credential':item.source==='Repairs'?'repair':'task'} →</a></article>)}</div>
      {!filtered.length&&<p className="cw-empty">{packet.items.length?'No tasks match these filters.':'No open tasks were returned by the available sources.'}</p>}
      {filtered.length>25&&<nav className="cw-pages" aria-label="Task pages"><button disabled={currentPage===0} onClick={()=>setPage(currentPage-1)}>Previous</button><span>Page {currentPage+1} of {Math.ceil(filtered.length/25)}</span><button disabled={(currentPage+1)*25>=filtered.length} onClick={()=>setPage(currentPage+1)}>Next</button></nav>}
    </>}
  </section>;
}
