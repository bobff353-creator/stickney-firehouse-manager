'use client';
import {useEffect,useState} from 'react';
import {drugErrors,drugIssues,drugResponse,drugSchema,type DrugResponse} from './inventory-drug-model';
import type {InventoryRow} from './inventory-index';
import './inventory/meter-check.css';
import './inventory/drug-check.css';

type Props={item:InventoryRow;apparatus:string;preview:boolean;canCheck:boolean;busy:boolean;onDirty:(id:string,dirty:boolean)=>void;onSave:(response:DrugResponse,version:number,complete:boolean,photo:File|null)=>Promise<InventoryRow>};
export default function DrugCheckEditor({item,apparatus,preview,canCheck,busy,onDirty,onSave}:Props){
 const [base,setBase]=useState(item),[draft,setDraft]=useState(()=>drugResponse(item.drug_response));
 const [saving,setSaving]=useState(false),[error,setError]=useState(''),[receipt,setReceipt]=useState(''),[photo,setPhoto]=useState<File|null>(null);
 const schema=drugSchema(base.drug_schema)!;
 const id=String(item.id),version=Number(base.drug_response_version||0),incoming=Number(item.drug_response_version||0);
 const dirty=JSON.stringify(draft)!==JSON.stringify(drugResponse(base.drug_response))||Boolean(photo),conflict=incoming>version;
 useEffect(()=>{onDirty(id,!preview&&dirty);return()=>onDirty(id,false);},[id,dirty,preview,onDirty]);
 if(conflict&&!dirty&&!saving){setBase(item);setDraft(drugResponse(item.drug_response));}
 const update=<K extends keyof DrugResponse>(key:K,value:DrugResponse[K])=>{setDraft(current=>({...current,[key]:value}));setReceipt('');setError('');};
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const issues=drugIssues(schema,draft,today),disabled=preview||!canCheck||busy||saving;
 const count=preview?schema.expectedQuantity:/^\d{1,3}$/.test(draft.count)?Math.min(100,Number(draft.count)):0;
 const changeCount=(value:string)=>{const n=schema.mode==='medication'&&/^\d{1,3}$/.test(value)?Math.min(100,Number(value)):0;setDraft(current=>({...current,count:value,expirations:Array.from({length:n},(_,i)=>current.expirations[i]||''),locations:Array.from({length:n},(_,i)=>current.locations[i]||'')}));setReceipt('');setError('');};
 async function save(complete:boolean){
  if(disabled||conflict)return;
  const errors=drugErrors(schema,draft,today,complete);
  if(complete&&issues.length&&!photo&&!base.drug_photo_id)errors.push('Attach a photo documenting the issue.');
  if(errors.length){setError(errors.join(' '));return;}
  setSaving(true);setError('');
  try{const saved=await onSave(draft,version,complete,photo);setBase(saved);setDraft(drugResponse(saved.drug_response));setPhoto(null);setReceipt(complete?'Item saved. Review the check before submitting.':'Draft saved. This item remains pending.');}
  catch(error){setError(error instanceof Error?error.message:'Save confirmation was not received. Refresh and review before retrying.');}
  finally{setSaving(false);}
 }
 const dateField=(value:string,onChange:(value:string)=>void,label:string)=><div className="drug-date"><label>{label}<input type="date" value={value==='unknown'?'':value} disabled={disabled||value==='unknown'} onChange={event=>onChange(event.target.value)}/></label><label className="drug-unknown"><input type="checkbox" checked={value==='unknown'} disabled={disabled} onChange={event=>onChange(event.target.checked?'unknown':'')}/>Unable to verify expiration</label></div>;
 return <article className="meter-check drug-check" aria-label={`${schema.title} drug inventory for ${apparatus}`}>
  <header><div><span>{apparatus} · DRUG INVENTORY</span><h3>{schema.title}</h3><p>{schema.location} · Required count {schema.expectedQuantity}</p></div><strong>{preview?'Read-only preview':base.result==='pending'?'Pending':base.result==='pass'?'Saved · satisfactory':'Saved · review result'}</strong></header>
  <details><summary>{preview?'Preview logging fields':dirty?'Continue unsaved entry':base.drug_response?'Review or edit saved entry':'Record actual observations'}</summary>
  {conflict&&<p role="alert">Another crew member saved this item. Your edits remain here. <button type="button" disabled={saving} onClick={()=>{if(!dirty||window.confirm('Replace your unsaved entry with the latest saved entry?')){setBase(item);setDraft(drugResponse(item.drug_response));setPhoto(null);}}}>Load latest saved entry</button></p>}
  <fieldset disabled={disabled} className="meter-fields"><legend>Observed result</legend>
   <label>Result<select value={draft.condition} onChange={event=>update('condition',event.target.value)}><option value="">Choose the observed result</option><option value="satisfactory">Satisfactory — record observations</option><option value="issue">Issue or unable to complete verification</option><option value="not_applicable">Not applicable — explain why</option></select></label>
   {draft.condition!=='not_applicable'&&<>
    {['medication','quantity'].includes(schema.mode)&&<label>Actual quantity counted<input type="number" inputMode="numeric" min="0" max="100" step="1" value={draft.count} onChange={event=>changeCount(event.target.value)}/></label>}
    {schema.mode==='medication'&&<><button type="button" disabled={disabled||!count} onClick={()=>update('locations',Array(count).fill(schema.location))}>Confirm all present containers at listed location</button><div className="drug-containers">{Array.from({length:count},(_,index)=><fieldset key={index} className="meter-fields"><legend>Container {index+1}</legend>{dateField(draft.expirations[index]||'',value=>update('expirations',draft.expirations.map((date,i)=>i===index?value:date)),'Expiration date')}<label>Observed location<input maxLength={240} value={draft.locations[index]||''} placeholder={schema.location} onChange={event=>update('locations',draft.locations.map((location,i)=>i===index?event.target.value:location))}/></label></fieldset>)}</div></>}
    {schema.mode==='expiration_date'&&dateField(draft.value,value=>update('value',value),'Observed expiration date')}
    {['numeric','mileage'].includes(schema.mode)&&<label>{schema.mode==='mileage'?'Odometer reading':'Numeric reading'}<input type="number" inputMode="decimal" min="0" step="0.1" value={draft.value} onChange={event=>update('value',event.target.value)}/></label>}
    {schema.mode==='text'&&<label>Observed entry<textarea maxLength={4000} rows={3} value={draft.value} onChange={event=>update('value',event.target.value)}/></label>}
   </>}
   <label>Comments / issue / reason<textarea rows={3} maxLength={4000} value={draft.notes} onChange={event=>update('notes',event.target.value)}/></label>
   {!!issues.length&&<div className="meter-attention"><strong>Needs attention</strong><ul>{issues.map(issue=><li key={issue}>{issue}</li>)}</ul><label>Photo documenting the issue<input type="file" accept="image/*" onChange={event=>setPhoto(event.target.files?.[0]||null)}/></label>{base.drug_photo_id&&!photo&&<p>A previously saved issue photo is attached.</p>}</div>}
  </fieldset>
  {!preview&&<footer><p role={error?'alert':'status'}>{error||receipt||(dirty?'Unsaved changes':'Saved observations stay with this check and its original logging format.')}</p><div><button type="button" disabled={disabled||conflict||!dirty} onClick={()=>void save(false)}>Save draft</button><button type="button" className="ops-primary" disabled={disabled||conflict||(!dirty&&base.result!=='pending')} onClick={()=>void save(true)}>Save item result</button></div></footer>}
  </details>
 </article>;
}
