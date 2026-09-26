'use client';
import { useEffect,useId,useRef,useState } from 'react';
import { certificationCatalog,OSFM_FORMS_URL } from './osfm-catalog';
import { osfmBooks,bookKey,taskKey,taskReference,taskDescription,bookKindLabel,searchCertifications,searchBookTasks,type OsfmBook } from './osfm-selection';

type Props={selected?:string[];onChange?:(ids:string[])=>void;onUseBook?:(book:OsfmBook)=>void;onTraining?:(kind:'activity'|'completion'|'assignment',ids:string[])=>void};
export function SelectedOsfmTasks({ids=[]}:{ids?:string[]}) {
  if(!ids.length)return null;
  return <details className="tr-panel"><summary>Selected OSFM references · {ids.length}</summary><p>Topics covered or planned. Proficiency sign-off is recorded separately.</p><ul className="tr-selected-tasks">{ids.map(id=>{const ref=taskReference(id);return <li key={id}>{ref?<><a href={`${ref.book.url}#page=${ref.page}`} target="_blank" rel="noreferrer">{ref.label}{ref.summary?' — '+ref.summary.title:''} · {ref.book.edition} ↗</a>{ref.summary&&<p>{ref.summary.description}</p>}</>:id}</li>;})}</ul></details>;
}
export default function OsfmTaskBrowser({selected=[],onChange,onUseBook,onTraining}:Props) {
  const [query,setQuery]=useState(''),[certId,setCertId]=useState(()=>taskReference(selected[0]??'')?.book.certificationId??''),[chosenBook,setChosenBook]=useState(()=>{const ref=taskReference(selected[0]??'');return ref?bookKey(ref.book):'';}),[taskQuery,setTaskQuery]=useState('');
  const pickerId=useId();
  const detailRef=useRef<HTMLElement>(null),catalogRef=useRef<HTMLDivElement>(null);
  useEffect(()=>{if(certId)detailRef.current?.scrollIntoView({block:'start'});},[certId]);
  const matches=searchCertifications(query),cert=certificationCatalog.find(c=>c.id===certId);
  const available=osfmBooks.filter(b=>b.certificationId===certId),book=available.find(b=>bookKey(b)===chosenBook)??available[0];
  const tasks=book?searchBookTasks(book,taskQuery):[];
  const selectedInBook=book?.jprs.filter(j=>selected.includes(taskKey(book,j.id))).length??0;
  const change=(ids:string[])=>onChange?.([...new Set(ids)]);
  function pick(id:string){setCertId(id);setChosenBook('');setTaskQuery('');}
  function toggle(id:string){change(selected.includes(id)?selected.filter(x=>x!==id):[...selected,id]);}
  return <section className="tr-osfm-browser" aria-label="OSFM task-book picker">
    <h3>Browse OSFM task books</h3><p>Find a book or training topic, then check the tasks you want to include.</p>
    <label className="tr-field">Search OSFM certifications and JPR numbers<input type="search" placeholder="Example: ladders, firefighter, 141.353, or 7.3.1" value={query} onChange={e=>setQuery(e.target.value)}/></label>
    <div className="tr-toolbar"><span>{matches.length} of {certificationCatalog.length} certifications · {osfmBooks.length} official books / forms</span>{query&&<button type="button" onClick={()=>setQuery('')}>Clear search</button>}</div>
    <div ref={catalogRef} className="tr-book-catalog" aria-label="OSFM certification results">{matches.map(c=><button type="button" key={c.id} aria-pressed={certId===c.id} onClick={()=>pick(c.id)}><strong>{c.title}</strong><small>Rule §{c.section} · {osfmBooks.filter(b=>b.certificationId===c.id).length?osfmBooks.filter(b=>b.certificationId===c.id).map(bookKindLabel).join(' / '):'Check official forms'}</small></button>)}{!matches.length&&<p>No matching certification or JPR. Try a name or shorter number.</p>}</div>
    {cert&&<section ref={detailRef} className="tr-panel" aria-label="Selected official task book"><button type="button" className="tr-back" onClick={()=>catalogRef.current?.scrollIntoView({block:'center'})}>← Back to certifications</button><div className="tr-heading"><div><small>Illinois OSFM · Rule §{cert.section}</small><h3>{cert.title}</h3></div><a href={cert.ruleUrl} target="_blank" rel="noreferrer">Official requirements ↗</a></div>
      {available.length?<><div className="tr-inline-actions">{available.map(b=><button key={bookKey(b)} type="button" aria-pressed={book===b} onClick={()=>{setChosenBook(bookKey(b));setTaskQuery('');}}>{bookKindLabel(b)}</button>)}</div>
        {book&&<><p><strong>{book.edition}</strong> · {book.bookDate||'Date shown in official book'} · {book.pageCount} pages</p>
          <div className="tr-inline-actions"><a href={book.url} target="_blank" rel="noreferrer">Read / scroll official task book ↗</a>{onUseBook&&<button type="button" onClick={()=>onUseBook(book)}>Use this task book</button>}</div>
          <p className="tr-muted">The official book opens in a new tab. Your selections stay here when you return.</p>
          {onChange&&<label className="tr-checkbox"><input type="checkbox" checked={selected.includes(taskKey(book))} onChange={()=>toggle(taskKey(book))}/>Include this whole book / form as a reference</label>}
          {book.jprs.length?<><label className="tr-field">Search this book’s JPRs and descriptions<input type="search" placeholder="Try a number or task: radio, hydrant, foam…" value={taskQuery} onChange={e=>setTaskQuery(e.target.value)}/></label>
            {onChange&&<p className="tr-note">Check a box to add that task. Uncheck it to remove it. {onTraining?'Then choose how to use your selections below.':'Choose Next or Save draft below to keep building this training.'}</p>}
            <div className="tr-toolbar"><span>{tasks.length} of {book.jprs.length} JPRs shown</span>{onChange&&<><strong role="status" aria-live="polite">{selectedInBook} selected in this book</strong><button type="button" disabled={!tasks.length} onClick={()=>change([...selected,...tasks.map(j=>taskKey(book,j.id))])}>Select all shown JPRs</button><button type="button" onClick={()=>change(selected.filter(id=>!id.startsWith(bookKey(book)+':')))}>Clear this book</button></>}</div>
            <div className="tr-task-list" aria-label="Official JPR numbers">{tasks.map(j=>{
              const summary=taskDescription(book,j.id),checked=selected.includes(taskKey(book,j.id));
              const descriptionId=`${pickerId}-${j.id}-description`;
              const content=<span className="tr-task-copy"><strong>JPR {j.id}{summary?' — '+summary.title:''}</strong><span className="tr-task-description" id={descriptionId}>{summary?.description??'Read the linked official task sheet for the requirements.'}</span>{!summary&&!!j.topics?.length&&<small>{j.topics.join(' · ')}</small>}{onChange&&<span className="tr-task-state">{checked?'✓ Selected':'Add to training'}</span>}</span>;
              return <div className={`tr-task-row${checked?' tr-task-selected':''}`} key={j.id}>{onChange?<label><input type="checkbox" aria-label={`Select JPR ${j.id}${summary?' — '+summary.title:''}`} aria-describedby={descriptionId} checked={checked} onChange={()=>toggle(taskKey(book,j.id))}/>{content}</label>:content}<a href={`${book.url}#page=${j.taskPage??j.page}`} target="_blank" rel="noreferrer" aria-label={`Read official JPR ${j.id} · PDF page ${j.taskPage??j.page}`}>{j.taskPage?'Task sheet':'Official index'} · page {j.taskPage??j.page} ↗</a></div>;
            })}{!tasks.length&&<p>No JPR matches this search. {taskQuery&&<button type="button" onClick={()=>setTaskQuery('')}>Clear task search</button>}</p>}</div>
          </>:<p className="tr-note">This official form does not have a verified numbered JPR index. Open the form to read its requirements; no task numbers have been invented.</p>}
          <p className="tr-muted">Descriptions are brief planning summaries. Use the linked official task sheets for all requirements. Selecting a task records a training topic; it does not certify proficiency or submit anything to OSFM.</p>
        </>}
      </>:<p className="tr-note">No prebuilt book has been verified for this certification. <a href={OSFM_FORMS_URL} target="_blank" rel="noreferrer">Check current OSFM forms ↗</a></p>}
    </section>}
    {onChange&&<div className="tr-selection-bar"><strong>{selected.length} references selected</strong>{selected.length>0&&<button type="button" onClick={()=>change([])}>Clear selections</button>}{onTraining&&<><button type="button" className="tr-primary" disabled={!selected.length} onClick={()=>onTraining('completion',selected)}>Record training with selections →</button><button type="button" disabled={!selected.length} onClick={()=>onTraining('assignment',selected)}>Assign selected training</button><button type="button" disabled={!selected.length} onClick={()=>onTraining('activity',selected)}>Save as reusable activity</button></>}</div>}
    <SelectedOsfmTasks ids={selected}/>
  </section>;
}
