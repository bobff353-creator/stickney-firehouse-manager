// Local-only transport. No production credentials, requests, or records.
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import InventoryReports, { InventoryAirHistory } from '../../app/inventory-reports';
import { historyPage, type HistoryReport } from '../../app/inventory-history';
import '../../app/globals.css';
import '../../app/inventory/inventory.css';
import '../../app/inventory/usability.css';

if (!['localhost','127.0.0.1'].includes(location.hostname)) throw Error('Local fixtures only');
const id = (n:number) => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const rig = id(9000), asset = id(9001);
const reports: HistoryReport[] = Array.from({length:61},(_,i)=>({
  id:id(i+1),apparatus_id:rig,apparatus_name:'TEST Engine',check_type:i%4===0?'air_pack':'daily',status:'completed',
  started_at:new Date(Date.UTC(2026,8,29-Math.floor(i/3),12)).toISOString(),
  completed_at:new Date(Date.UTC(2026,8,29-i,13)).toISOString(),started_by:'FICTIONAL crew',
  review_status:i%2===0?'pending':'approved',item_count:i===2?1005:3,passed_count:i===2?1004:2,issue_count:1,
})).sort((a,b)=>b.started_at.localeCompare(a.started_at)||b.id.localeCompare(a.id));
let reads=0,details=0,fail=false,printed=0;
function recordTransport() { document.getElementById('transport')!.textContent=`History reads: ${reads} · Full reports loaded: ${details} · Prints: ${printed}`; }
window.print=()=>{printed++;recordTransport();document.getElementById('printed')!.textContent=`Print prepared with ${document.querySelectorAll('.inventory-report-detail tbody tr').length} complete result rows.`;};
window.fetch=async(input,init)=>{
  const url=new URL(String(input),location.origin);
  if(url.pathname!=='/api/operations/history')throw Error('External/unknown requests are blocked in this fixture');
  if(init?.signal?.aborted)throw new DOMException('Aborted','AbortError');
  if(fail){fail=false;return Response.json({error:'SIMULATED history unavailable'},{status:503});}
  const check=url.searchParams.get('check');
  if(check){
    details++;recordTransport();const row=reports.find(r=>r.id===check);
    if(!row)return Response.json({error:'Missing test report'},{status:404});
    return Response.json({check:row,items:Array.from({length:Number(row.item_count)},(_,i)=>({id:id(10000+i),equipment_name:`TEST item ${i+1}`,compartment_label:'TEST cabinet',result:i===0?'failed':'pass',numeric_reading:i,notes:'Fictional result',checked_by:'FICTIONAL crew'}))});
  }
  reads++;recordTransport();
  const cursor=url.searchParams.get('cursor');
  let rows=reports.filter(r=>(!url.searchParams.get('type')||r.check_type===url.searchParams.get('type'))&&(!url.searchParams.get('review')||r.review_status===url.searchParams.get('review'))&&(!url.searchParams.get('from')||String(r.completed_at).slice(0,10)>=url.searchParams.get('from')!)&&(!url.searchParams.get('to')||String(r.completed_at).slice(0,10)<=url.searchParams.get('to')!));
  if(cursor){const [time,key]=cursor.split('|');rows=rows.filter(r=>r.started_at<time||(r.started_at===time&&r.id<key));}
  return Response.json(historyPage(rows.slice(0,26)));
};
function Preview(){
  const [busy,setBusy]=useState(false);
  return <>
    <aside style={{padding:12,background:'#fff3bc',color:'#152e38'}}>FICTIONAL LOCAL TEST ONLY · 61 saved reports<br/><output id="transport">History reads: 0 · Full reports loaded: 0 · Prints: 0</output><br/><output id="printed"/><button onClick={()=>{fail=true;}}>Fail next history request</button></aside>
    <main className="inventory-app-shell inventory-portal-refresh"><section className="page reports-page inventory-ops">
      <InventoryReports apparatus={[{id:rig,name:'TEST Engine'}]} canReview busy={busy} onReview={async(check,decision,note)=>{
        if(decision==='changes_requested'&&!note)return false;
        setBusy(true);const row=reports.find(r=>r.id===check);if(row){row.review_status=decision;row.review_notes=note;row.reviewed_by='FICTIONAL administrator';}setBusy(false);return Boolean(row);
      }}/>
      <InventoryAirHistory equipmentId={asset}/>
    </section></main>
  </>;
}
createRoot(document.getElementById('root')!).render(<Preview/>);
