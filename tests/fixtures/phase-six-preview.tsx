import React from 'react';
import {createRoot} from 'react-dom/client';
import IncidentCommandBoard from '../../app/incident-command-board';
import {emptyIncidentCommandState,reduceIncidentCommandState,type CommandAction} from '../../app/incident-command-state';
import '../../app/globals.css';
import '../../app/remaining-bento.css';
if(!['localhost','127.0.0.1'].includes(location.hostname))throw Error('Local fixture only');
let disconnected=false,loseResponse=false,active=true;
let state=JSON.parse(sessionStorage.getItem('phase6-fixture-board')||'null')||emptyIncidentCommandState();
let events:unknown[]=JSON.parse(sessionStorage.getItem('phase6-fixture-events')||'[]');
const receipts:Record<string,unknown>=JSON.parse(sessionStorage.getItem('phase6-fixture-receipts')||'{}');
const persist=()=>{sessionStorage.setItem('phase6-fixture-board',JSON.stringify(state));sessionStorage.setItem('phase6-fixture-events',JSON.stringify(events));sessionStorage.setItem('phase6-fixture-receipts',JSON.stringify(receipts));};
const incident={incidentId:'fixture-call',reportNumber:'fixture-call',callType:'Fictional practice call',address:'100 Fictional Practice Way',city:'Test city',respondingUnits:'TEST1 TEST2',dispatchedAt:new Date().toISOString(),source:'Local fixture',receivedAt:new Date().toISOString()};
window.fetch=async(input,options)=>{
 if(!String(input).startsWith('/api/incident-command'))throw Error('Unexpected fixture request');
 if(disconnected)throw new TypeError('Simulated fixture connection loss');
 if(options?.method==='POST'){
  const b=JSON.parse(String(options.body)) as {requestId:string;incidentId:string;expectedRevision:number;mutation:CommandAction;receiptOnly:boolean};
  if(receipts[b.requestId])return Response.json({...receipts[b.requestId] as object,replayed:true});
  if(b.receiptOnly)return Response.json({error:'No confirmed save exists for this local draft'},{status:409});
  if(!active||b.incidentId!==incident.incidentId||b.expectedRevision!==state.revision)return Response.json({error:'The fictional board changed. Review the latest version.'},{status:409});
  const r=reduceIncidentCommandState(state,b.mutation,{actor:'Fictional officer',now:new Date().toISOString(),validPersonnel:new Set(['fixture-person']),validUnits:new Set(['TEST1','TEST2',...state.manualUnits]),validLevels:new Set(['Floor 1'])});
  state=r.state;const event={id:b.requestId,revision:state.revision,eventType:r.eventType,summary:r.summary,actor:'Fictional officer',createdAt:new Date().toISOString()};events=[event,...events];
  const receipt={ok:true,incidentId:incident.incidentId,requestId:b.requestId,savedRevision:state.revision};receipts[b.requestId]=receipt;persist();
  if(loseResponse){loseResponse=false;throw new TypeError('Save succeeded in fixture but its response was lost');}
  return Response.json({...receipt,state,event});
 }
 return Response.json({departmentId:'fictional-department',draftScope:'fictional-command-scope',selectedIncident:'fixture-call',incident:active?incident:null,preplan:null,personnel:[{id:'fixture-person',name:'Fictional Officer',rank:'Officer'}],cadUnits:['TEST1','TEST2'],state:active?state:null,events,canManage:true,connection:{status:'stored',label:'Stored local practice incident · Upstream CAD connection not independently verified',stale:false,lastUpdatedAt:incident.receivedAt},generatedAt:new Date().toISOString()});
};
createRoot(document.getElementById('root')!).render(<><style>{'.phase6-fixture-tools{max-height:80px;overflow:auto}@media(max-width:640px){.phase6-fixture-tools{max-height:170px}}.icb-page:has(.icb-reference-header){top:85px!important;height:calc(100dvh - 85px)!important} @media(max-width:640px){.icb-page:has(.icb-reference-header){top:175px!important;height:calc(100dvh - 175px)!important}}'}</style><aside className="phase6-fixture-tools" style={{position:'relative',zIndex:7000,background:'#fff0cc',color:'#172d45',padding:12,display:'flex',flexWrap:'wrap',gap:8,alignItems:'center'}}><strong>Fictional local practice · no department writes</strong><button onClick={()=>{disconnected=true;}}>Lose fixture connection</button><button onClick={()=>{disconnected=false;}}>Restore fixture connection</button><button onClick={()=>{loseResponse=true;}}>Lose next save response</button><button onClick={()=>{state={...state,revision:state.revision+1,radioChannel:'Newer fictional server channel'};persist();}}>Simulate concurrent edit</button><button onClick={()=>{active=false;}}>Clear fixture incident</button><button onClick={()=>{document.documentElement.dataset.theme=document.documentElement.dataset.theme==='dark'?'light':'dark';}}>Toggle theme</button></aside><main className="workspace"><IncidentCommandBoard/></main></>);
