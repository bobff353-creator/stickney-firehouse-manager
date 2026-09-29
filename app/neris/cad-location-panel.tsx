'use client';
import {useState} from 'react';
import {cadLocation,hasRecordedLocation,recordedDispatchSource,withCadLocation,type CadCall,type CadLocationSource} from './cad-location';
import {humanLabel,type NerisData} from './model';

export function CadLocationPanel({data,onChange}:{data:NerisData;onChange:(data:NerisData)=>void}) {
  const source=data.local.cadLocation||recordedDispatchSource(data),[calls,setCalls]=useState<CadCall[]|null>(null),[selected,setSelected]=useState<CadLocationSource|null>(null),[query,setQuery]=useState(data.local.cadSourceId||''),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const candidate=selected||source,existing=hasRecordedLocation(data),available=candidate?cadLocation(candidate):{};
  async function search(){setBusy(true);setError('');try{const r=await fetch(`/api/neris/cad?q=${encodeURIComponent(query)}`,{cache:'no-store'}),j=await r.json();if(!r.ok)throw Error(j.error||'Saved calls could not load.');setCalls(j.calls);setSelected(null);}catch(e){setError(e instanceof Error?e.message:'Saved calls could not load.');}finally{setBusy(false);}}
  function apply(){if(!candidate)return;onChange(withCadLocation(data,candidate));setCalls(null);setSelected(null);}
  return <section className="nr-cad-location" aria-label="Fill location from CAD">
    <div className="nr-section-title"><div><p className="nr-eyebrow">USE THE SAVED CALL</p><h3>{data.local.cadLocation?'Address copied from CAD':'Fill location from CAD'}</h3></div>{data.local.cadLocation&&<span className="nr-badge">Review address</span>}</div>
    <p>{data.local.cadLocation?'Confirm this was the final incident location. Every field below remains editable.':'Choose a saved CAD call to fill the address fields. Missing or unclear details stay unanswered.'}</p>
    {candidate&&<><div className="nr-cad-source"><strong>CAD {candidate.id||'dispatch address'}</strong><p>{candidate.address||'No street address supplied'}{candidate.city&&!candidate.address.toLowerCase().includes(candidate.city.toLowerCase())?`, ${candidate.city}`:''}</p></div>
      {!data.local.cadLocation&&<dl className="nr-cad-preview">{Object.entries(available).filter(([key])=>key!=='additional_info').map(([key,value])=><div key={key}><dt>{humanLabel(key)}</dt><dd>{String(value)}</dd></div>)}</dl>}
      {!available.street&&candidate.address&&<p className="nr-inline-note">This address could not be fully separated into fields. Check the original CAD text and complete the missing details below.</p>}
      {!existing&&<button className="nr-primary" type="button" disabled={busy||!Object.keys(available).length} onClick={apply}>Use this CAD address</button>}
    </>}
    {existing&&!data.local.cadLocation&&<p className="nr-inline-note">This report already has location information. Your entries have been kept; compare the CAD address with the fields below.</p>}
    {!existing&&<div className="nr-actions"><button type="button" disabled={busy} onClick={()=>void search()}>{busy?'Loading calls…':candidate?'Choose a different saved call':'Choose a CAD call'}</button></div>}
    {error&&<p className="nr-alert" role="alert">{error}</p>}
    {calls&&<div className="nr-cad-picker"><div className="nr-actions"><label>Find CAD call<input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Incident number or address"/></label><button type="button" disabled={busy} onClick={()=>void search()}>Search CAD calls</button><button type="button" onClick={()=>{setCalls(null);setSelected(null);}}>Close call picker</button></div>
      <div className="nr-cad-results">{calls.map(call=><button type="button" className="nr-call" key={call.id} onClick={()=>{setSelected({id:call.id,address:call.address,city:call.city});setCalls(null);}}><strong>{call.id} · {call.callType}</strong><span>{call.address} · {call.dispatchedAt}</span></button>)}{!calls.length&&<p>No matching saved CAD calls. Try another incident number or enter the address below.</p>}</div>
    </div>}
    <small>Only address details supplied in CAD are copied. No apartment, state, ZIP code or incident facts are guessed. Changes save with your report.</small>
  </section>;
}
