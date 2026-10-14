'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {useWorkspaceViewState,restoreWorkspaceScroll} from './workspace-view-state';
import {parseQueueView,emptyQueueView,filterQueue,taskQueueCsv,type QueueView} from './task-queue-view';
import {taskDueState,type QueueTask,type DueState} from './task-queue-model';
type Packet={items:QueueTask[];today:string;viewerIds:string[];privateAccess:boolean;sources:{name:string;state:string}[];generatedAt:string};
export default function TaskQueue(){
 const [packet,setPacket]=useState<Packet|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(true);
 const active=useRef<AbortController|null>(null);
 const [view,setView]=useWorkspaceViewState<QueueView>('task-queue-view',()=>typeof window==='undefined'?emptyQueueView():parseQueueView(new URLSearchParams(window.location.search).get('queueView')));
 const [report,setReport]=useState<{items:QueueTask[];packet:Packet;view:QueueView}|null>(null),[downloadError,setDownloadError]=useState('');
 const reportDialog=useRef<HTMLDialogElement>(null),restored=useRef(false);
 useEffect(()=>{if(report)reportDialog.current?.showModal();},[report]);
 useEffect(()=>{if(packet&&!busy&&!restored.current){restored.current=true;return restoreWorkspaceScroll(view.scroll);}},[packet,busy,view.scroll]);
 const load=useCallback(async(signal?:AbortSignal)=>{
  await Promise.resolve();if(signal?.aborted)return;active.current?.abort();const controller=new AbortController();active.current=controller;
  const requestSignal=signal?AbortSignal.any([signal,controller.signal]):controller.signal;setBusy(true);setError('');
  try{const response=await fetch('/api/task-queue',{cache:'no-store',signal:requestSignal}),data=await response.json();if(!response.ok)throw Error(data.error||'The task queue could not load.');if(!requestSignal.aborted)setPacket(data);}
  catch(e){if(!requestSignal.aborted){setPacket(null);setError(e instanceof Error?e.message:'The task queue could not load.');}}
  finally{if(!requestSignal.aborted)setBusy(false);}
 },[]);
 useEffect(()=>{const controller=new AbortController();void Promise.resolve().then(()=>load(controller.signal));return()=>{controller.abort();active.current?.abort();};},[load]);
 const filtered=packet?filterQueue(packet.items,view,packet.today,packet.viewerIds):[],currentPage=Math.min(view.page,Math.max(0,Math.ceil(filtered.length/25)-1)),visible=filtered.slice(currentPage*25,currentPage*25+25);
 function choose(patch:Partial<QueueView>){setView(v=>({...v,...patch,page:0,scroll:0}));}
 function openTask(href:string){const saved={...view,page:currentPage,scroll:window.scrollY};setView(saved);const here=new URL(window.location.href);here.searchParams.set('queueView',JSON.stringify(saved));window.history.replaceState(window.history.state,'',here.pathname+here.search);const next=new URL(href,window.location.origin);next.searchParams.set('queueReturn',JSON.stringify(saved));window.location.assign(next.pathname+next.search);}
 function exportCsv(items:QueueTask[],filters:QueueView,snapshot:Packet){try{const url=URL.createObjectURL(new Blob([taskQueueCsv(items,filters,snapshot)],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='task-queue.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setDownloadError('');}catch{setDownloadError('The download could not start. Keep this view open and retry.');}}
 return <section className="connected-work task-queue" aria-label="Task queue">
  <header><div><p className="cw-eyebrow">Department work</p><h1>Task queue</h1><p>Review assigned work and recorded due dates. Open a task to update it in its original workspace.</p></div><button disabled={busy} onClick={()=>void load()}>{busy?'Loading…':'Refresh tasks'}</button></header>
  {error&&<p className="cw-notice" role="alert">{error} <button onClick={()=>void load()}>Retry</button></p>}
  {packet&&<>
   <p className="cw-caption">Loaded {new Date(packet.generatedAt).toLocaleString('en-US',{timeZone:'America/Chicago'})} · Department dates use America/Chicago.</p>
   {packet.sources.some(s=>s.state==='unavailable')&&<p className="cw-notice" role="alert">Some work could not load: {packet.sources.filter(s=>s.state==='unavailable').map(s=>s.name).join(', ')}. Counts cover the available sources only. <button disabled={busy} onClick={()=>void load()}>Retry sources</button></p>}
   {!packet.sources.length&&<p className="cw-notice">No connected task sources are available with your current access.</p>}
   <div className="cw-counts">{(['Overdue','Today','Next 30 days','Date needed','Date needs review'] as DueState[]).map(state=><button key={state} aria-pressed={view.due===state} onClick={()=>choose({due:state})}><strong>{packet.items.filter(item=>taskDueState(item,packet.today)===state).length}</strong><span>{state}</span></button>)}</div>
   <div className="cw-filters"><label>Find a task<input aria-label="Find a task" type="search" maxLength={160} value={view.query} onChange={e=>choose({query:e.target.value})} placeholder="Task, location or assigned member"/></label><label>Workspace<select aria-label="Workspace" value={view.source} onChange={e=>choose({source:e.target.value})}><option>All</option>{[...new Set([...packet.items.map(item=>item.source),...(view.source!=='All'?[view.source]:[])])].map(value=><option key={value}>{value}</option>)}</select></label><label>Due date<select aria-label="Due date" value={view.due} onChange={e=>choose({due:e.target.value})}>{['Attention','All','Overdue','Today','Next 30 days','Later','Date needed','Date needs review'].map(value=><option key={value}>{value}</option>)}</select></label></div>
   <label className="cw-check"><input type="checkbox" checked={view.mine} onChange={e=>choose({mine:e.target.checked})}/>My tasks only</label>
   {view.mine&&<p className="cw-caption">Matches your saved member ID. Unassigned work and text-only repair assignments appear under All tasks.</p>}
   {packet.privateAccess&&<p className="cw-caption">Private training and inspection records appear only for the designated pilot owner. Credential dates are review reminders; no messages are sent and duty eligibility is unchanged.</p>}
   <p role="status">{filtered.length} matching {filtered.length===1?'task':'tasks'}{filtered.length>25?` · Showing ${currentPage*25+1}–${currentPage*25+visible.length}`:''}</p>
   <div className="cw-pages"><button disabled={busy} onClick={()=>setReport(structuredClone({items:filtered,packet,view}))}>Preview filtered task report</button><button disabled={busy} onClick={()=>exportCsv(filtered,view,packet)}>Export filtered tasks CSV</button></div>{downloadError&&<p role="alert">{downloadError}</p>}
   <div className="cw-list">{visible.map(item=><article key={item.id}><div className="cw-row-heading"><span>{item.source} · {item.status}</span><strong className="cw-badge">{taskDueState(item,packet.today)}</strong></div><h2>{item.title}</h2>{item.detail&&<p>{item.detail}</p>}<p>Assigned: {item.assignees.join(', ')||'Not assigned'}</p><p>Recorded date: {item.dueDate||'Not recorded'}{item.invalidDate?' · Check the source date':''}</p><a className="cw-link" href={item.href+'&'+new URLSearchParams({queueReturn:JSON.stringify({...view,page:currentPage})})} onClick={e=>{if(!e.ctrlKey&&!e.metaKey&&!e.shiftKey&&!e.altKey){e.preventDefault();openTask(item.href);}}}>Open {item.source==='Credentials'?'credential':item.source==='Repairs'?'repair':'task'} →</a></article>)}</div>
   {!filtered.length&&<p className="cw-empty">{packet.items.length?'No tasks match these filters.':'No open tasks were returned by the available sources.'}</p>}
   {filtered.length>25&&<nav className="cw-pages" aria-label="Task pages"><button disabled={currentPage===0} onClick={()=>setView(v=>({...v,page:currentPage-1}))}>Previous</button><span>Page {currentPage+1} of {Math.ceil(filtered.length/25)}</span><button disabled={(currentPage+1)*25>=filtered.length} onClick={()=>setView(v=>({...v,page:currentPage+1}))}>Next</button></nav>}
  </>}
  {report&&<dialog ref={reportDialog} className="cw-report-dialog" aria-labelledby="task-report-title" onClose={()=>setReport(null)}><header><h2 id="task-report-title">Filtered task report</h2><button onClick={()=>reportDialog.current?.close()}>Close report preview</button></header><p>Snapshot: {report.packet.generatedAt} · Department day: {report.packet.today}</p><p>Filters: {report.view.source} · {report.view.due} · {report.view.mine?'My tasks':'All assigned members'} · Search: {report.view.query||'None'}</p><p>Sources: {report.packet.sources.map(s=>s.name+': '+s.state).join('; ')}</p><p>{report.items.length} matching tasks. Counts cover available permitted sources only. Reminders do not certify readiness or completed work.</p><button onClick={()=>exportCsv(report.items,report.view,report.packet)}>Export this snapshot CSV</button><button onClick={()=>window.print()}>Print task report / Save PDF</button>{report.items.map(item=><article key={item.id}><h3>{item.title}</h3><p>{item.source} · {item.status} · {taskDueState(item,report.packet.today)} · {item.dueDate||'Date not recorded'}</p><p>{item.detail}</p><p>Assigned: {item.assignees.join(', ')||'Not assigned'}</p></article>)}</dialog>}
 </section>;
}
