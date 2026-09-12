'use client';
/* eslint-disable @next/next/no-img-element -- authenticated original photos must not pass through a public optimizer. */
import { useEffect, useRef, useState } from 'react';
import { photoSymbols, readIllustrations, type IllustratedPhoto, type PhotoIllustration, type PhotoSymbol } from './photo-illustrations';
import './photo-illustrations.css';

function SymbolGraphic({mark}:{mark:Pick<PhotoIllustration,'symbol'|'label'>}){
  const meta=photoSymbols.find(([id])=>id===mark.symbol)??photoSymbols[0];
  const color=meta[3]==='Utilities'?'#175ab0':meta[3]==='Hazards'?'#b42318':meta[3]==='Access'?'#087348':meta[3]==='Sides'?'#ffe15c':'#b42318';
  const ink=meta[3]==='Sides'?'#142c3d':'#fff';
  return <svg viewBox="0 0 100 100" aria-hidden="true">
    {mark.symbol==='arrow'?<path d="M6 40H57V15L96 50 57 85V60H6Z" fill="#ffe15c" stroke="#142c3d" strokeWidth="4"/>:mark.symbol==='circle'?<circle cx="50" cy="50" r="44" fill="none" stroke="#ffdf32" strokeWidth="8"/>:<><rect x="4" y="4" width="92" height="92" rx={meta[3]==='Hazards'?'46':'12'} fill={color} stroke="white" strokeWidth="5"/><text x="50" y="52" dominantBaseline="middle" textAnchor="middle" fill={ink} fontFamily="system-ui,sans-serif" fontWeight="900" fontSize={meta[1].length>2?'28':'43'}>{meta[1]}</text></>}
  </svg>;
}
const styleFor=(mark:PhotoIllustration)=>({left:`${mark.x}%`,top:`${mark.y}%`,width:`${mark.size}%`,transform:`translate(-50%, -50%) rotate(${mark.rotation}deg)`});
export function IllustratedPhotoView({photo,alt}:{photo:IllustratedPhoto;alt:string}){
  const marks=readIllustrations(photo.illustrations);
  return <div className="illustrated-photo-view"><div className="photo-illustration-stage"><img src={photo.url} alt={alt}/>{marks.map(mark=><span key={mark.id} className="photo-mark" style={styleFor(mark)} title={mark.label||photoSymbols.find(([id])=>id===mark.symbol)?.[2]}><SymbolGraphic mark={mark}/>{mark.label&&<span className="photo-mark-label">{mark.label}</span>}</span>)}</div>{marks.length>0&&<small className="photo-illustration-disclaimer">Photo illustrations only · not mapped locations or verified equipment status.</small>}</div>;
}

export default function PhotoIllustrationEditor({photo,onClose,onSaved}:{photo:IllustratedPhoto;onClose:()=>void;onSaved:(photo:IllustratedPhoto)=>void}){
  const [initial]=useState(()=>({marks:readIllustrations(photo.illustrations),caption:photo.caption}));
  const [draft,setDraft]=useState(initial),[selected,setSelected]=useState(''),[placing,setPlacing]=useState<PhotoSymbol|null>(null);
  const [query,setQuery]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[loaded,setLoaded]=useState(false),[imageFailed,setImageFailed]=useState(false);
  const [undo,setUndo]=useState<typeof draft[]>([]),[redo,setRedo]=useState<typeof draft[]>([]);
  const dialog=useRef<HTMLDialogElement>(null),stage=useRef<HTMLDivElement>(null);
  const drag=useRef<{id:string;x:number;y:number;initial:typeof draft;moved:boolean}|null>(null);
  const dirty=JSON.stringify(initial)!==JSON.stringify(draft);
  const mark=draft.marks.find(item=>item.id===selected);
  const filtered=photoSymbols.filter(item=>item.join(' ').toLowerCase().includes(query.toLowerCase()));
  const close=()=>{if(busy)return;if(!dirty||window.confirm('Discard unsaved photo changes? The original photo and last saved symbols will stay unchanged.'))onClose();};
  useEffect(()=>{
    const current=dialog.current,previous=document.activeElement as HTMLElement|null,overflow=document.body.style.overflow;
    current?.showModal();document.body.style.overflow='hidden';
    return()=>{current?.close();document.body.style.overflow=overflow;previous?.focus();};
  },[]);
  useEffect(()=>{if(!dirty)return;const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[dirty]);
  function change(next:typeof draft){setUndo(items=>[...items,draft].slice(-50));setRedo([]);setDraft(next);setError('');}
  function update(values:Partial<PhotoIllustration>){if(mark)change({...draft,marks:draft.marks.map(item=>item.id===mark.id?{...item,...values}:item)});}
  function add(x:number,y:number){if(!placing||draft.marks.length>=80||!loaded||busy)return;const id=crypto.randomUUID();change({...draft,marks:[...draft.marks,{id,symbol:placing,x,y,size:9,rotation:0,label:''}]});setSelected(id);setPlacing(null);}
  function pointerMove(event:React.PointerEvent<HTMLButtonElement>){
    const current=drag.current,box=stage.current?.getBoundingClientRect();if(!current||!box)return;
    const dx=event.clientX-current.x,dy=event.clientY-current.y;if(Math.abs(dx)+Math.abs(dy)<3&&!current.moved)return;
    current.moved=true;const original=current.initial.marks.find(item=>item.id===current.id)!;
    setDraft({...current.initial,marks:current.initial.marks.map(item=>item.id===current.id?{...item,x:Math.max(0,Math.min(100,original.x+dx/box.width*100)),y:Math.max(0,Math.min(100,original.y+dy/box.height*100))}:item)});
  }
  function finishDrag(){if(drag.current?.moved){const before=drag.current.initial;setUndo(items=>[...items,before].slice(-50));setRedo([]);}drag.current=null;}
  async function save(){
    if(busy||!dirty||!loaded)return;setBusy(true);setError('');
    try{
      const response=await fetch(`/api/field-preplans/photos/${encodeURIComponent(photo.id)}/illustrations`,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({version:photo.illustrationVersion??0,caption:draft.caption,illustrations:draft.marks})});
      const body=await response.json() as {error?:string;version:number;illustrations:PhotoIllustration[];caption:string};
      if(!response.ok)throw new Error(body.error||'Unable to save photo symbols.');
      onSaved({...photo,caption:body.caption,illustrations:body.illustrations,illustrationVersion:body.version});
      onClose();
    }catch(reason){setError(reason instanceof Error?reason.message:'Unable to save. Your photo edits remain here.');}finally{setBusy(false);}
  }
  return <dialog ref={dialog} className="photo-illustration-dialog" aria-labelledby="photo-editor-title" onCancel={event=>{event.preventDefault();close();}}>
    <header><div><small>ILLUSTRATION ONLY · ORIGINAL PHOTO PRESERVED</small><h2 id="photo-editor-title">Edit {photo.side}-side photo symbols</h2><p>Choose a symbol → tap the photo → Save photo changes.</p></div><button type="button" disabled={busy} onClick={close}>Cancel / close</button></header>
    <div className="photo-editor-layout">
      <aside className="photo-symbol-library"><label>Find a symbol<input type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder="FDC, gas, entry, arrow…"/></label><div className="photo-symbol-results" aria-label="Photo symbol library">{filtered.map(([id,,label,group])=><button key={id} type="button" aria-pressed={placing===id} disabled={!loaded||busy||draft.marks.length>=80} onClick={()=>{setPlacing(id);setSelected('');}}><SymbolGraphic mark={{symbol:id,label:''}}/><span>{label}<small>{group}</small></span></button>)}{!filtered.length&&<p>No matching symbols. Try a different word or use Custom text label.</p>}</div></aside>
      <section className="photo-editor-workspace" aria-label="Photo canvas and selected symbol">
        <div className="photo-editor-hint" role="status">{placing?`Tap the photo to place: ${photoSymbols.find(([id])=>id===placing)?.[2]}.`:'Select a symbol on the photo to move or edit it. Drag it, use arrow keys, or use the position controls below.'}{placing&&<button type="button" onClick={()=>setPlacing(null)}>Cancel placement</button>}</div>
        <div ref={stage} className={`photo-illustration-stage editable${placing?' placing':''}`} role="group" aria-label={`${photo.side}-side photo canvas`} onClick={event=>{const box=stage.current!.getBoundingClientRect();add((event.clientX-box.left)/box.width*100,(event.clientY-box.top)/box.height*100);}}>
          <img src={photo.url} alt={`${photo.side}-side original photo`} draggable={false} onLoad={()=>{setLoaded(true);setImageFailed(false);}} onError={()=>{setLoaded(false);setImageFailed(true);}}/>
          {loaded&&draft.marks.map(item=><button type="button" key={item.id} className={`photo-mark${selected===item.id?' selected':''}`} style={styleFor(item)} disabled={busy} aria-label={`${photoSymbols.find(([id])=>id===item.symbol)?.[2]}${item.label?`: ${item.label}`:''}`} aria-pressed={selected===item.id} onClick={event=>{event.stopPropagation();setSelected(item.id);setPlacing(null);}} onPointerDown={event=>{if(busy)return;event.stopPropagation();event.currentTarget.setPointerCapture(event.pointerId);setSelected(item.id);setPlacing(null);drag.current={id:item.id,x:event.clientX,y:event.clientY,initial:draft,moved:false};}} onPointerMove={pointerMove} onPointerUp={finishDrag} onPointerCancel={finishDrag} onKeyDown={event=>{if(!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.key))return;event.preventDefault();const step=event.shiftKey?5:1;change({...draft,marks:draft.marks.map(m=>m.id!==item.id?m:{...m,x:Math.max(0,Math.min(100,m.x+(event.key==='ArrowLeft'?-step:event.key==='ArrowRight'?step:0))),y:Math.max(0,Math.min(100,m.y+(event.key==='ArrowUp'?-step:event.key==='ArrowDown'?step:0)))})});}}><SymbolGraphic mark={item}/>{item.label&&<span className="photo-mark-label">{item.label}</span>}</button>)}
        </div>
        {imageFailed&&<p role="alert">Original photo unavailable. Close and reopen when connected; nothing has changed.</p>}
        {placing&&<button type="button" disabled={busy||!loaded} onClick={()=>add(50,50)}>Place in center (then move)</button>}
        <div className="photo-edit-history"><button disabled={busy||!undo.length} onClick={()=>{setRedo(items=>[...items,draft]);setDraft(undo.at(-1)!);setUndo(items=>items.slice(0,-1));setSelected('');}}>Undo</button><button disabled={busy||!redo.length} onClick={()=>{setUndo(items=>[...items,draft]);setDraft(redo.at(-1)!);setRedo(items=>items.slice(0,-1));setSelected('');}}>Redo</button><span>{draft.marks.length}/80 symbols</span></div>
        {mark&&<fieldset className="photo-selected-controls" disabled={busy}><legend>Selected: {photoSymbols.find(([id])=>id===mark.symbol)?.[2]}</legend><label>Label (optional)<input maxLength={32} value={mark.label} onChange={event=>update({label:event.target.value})}/></label><label>Size<input type="range" min="4" max="20" step="1" value={mark.size} onChange={event=>update({size:Number(event.target.value)})}/></label><label>Rotate<select value={mark.rotation} onChange={event=>update({rotation:Number(event.target.value)})}>{[0,45,90,135,180,225,270,315,360].map(n=><option key={n} value={n}>{n}°</option>)}</select></label><label>Left / right (%)<input type="number" min="0" max="100" value={Math.round(mark.x)} onChange={event=>update({x:Math.max(0,Math.min(100,Number(event.target.value)))})}/></label><label>Up / down (%)<input type="number" min="0" max="100" value={Math.round(mark.y)} onChange={event=>update({y:Math.max(0,Math.min(100,Number(event.target.value)))})}/></label><button type="button" onClick={()=>{change({...draft,marks:draft.marks.filter(item=>item.id!==mark.id)});setSelected('');}}>Remove selected symbol</button></fieldset>}
        <label className="photo-caption-field">Photo caption<input maxLength={500} value={draft.caption} disabled={busy} onChange={event=>change({...draft,caption:event.target.value})}/></label>
        <p className="photo-illustration-disclaimer">These are visual notes, not verified equipment status. No map pins, asset links, or operational records are created.</p>
      </section>
    </div>
    <footer><div role={error?'alert':'status'}>{error|| (busy?'Saving photo changes…':dirty?'Unsaved photo changes':'No unsaved photo changes')}</div><button type="button" disabled={busy} onClick={close}>Cancel</button><button type="button" className="primary-action" disabled={busy||!dirty||!loaded} onClick={()=>void save()}>{busy?'Saving…':'Save photo changes'}</button></footer>
  </dialog>;
}
