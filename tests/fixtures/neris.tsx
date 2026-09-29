import React from 'react';
import {createRoot} from 'react-dom/client';
import Workspace from '../../app/neris/workspace';
import {validateReport} from '../../app/neris/validation';
import type {NerisRecord} from '../../app/neris/model';
if(!['127.0.0.1','localhost'].includes(location.hostname))throw Error('Local fixture only');
let records:NerisRecord[]=JSON.parse(sessionStorage.getItem('neris-fixture')||'[]'),fail=false;
const audit:Record<string,unknown[]>={};
window.fetch=async(input,options)=>{
 const url=String(input);if(!url.startsWith('/api/neris'))throw Error('Unexpected fixture request');
 if(options?.method==='POST'){
  const body=JSON.parse(String(options.body));if(body.action==='validate')return Response.json({issues:validateReport(body.data),officialValidation:false});
  if(fail){fail=false;return Response.json({error:'Simulated connection failure. Keep your draft and retry.'},{status:503});}
  const old=records.find(r=>r.id===body.id);if((old?.version||0)!==body.version)return Response.json({error:'Another tab changed this record. Your draft is kept.'},{status:409});
  const record={...body,version:body.version+1,updatedAt:new Date().toISOString(),updatedBy:'fictional@example.invalid'};records=[record,...records.filter(r=>r.id!==record.id)];sessionStorage.setItem('neris-fixture',JSON.stringify(records));(audit[record.id]??=[]).push({version:record.version,payload:JSON.stringify(record.data),createdAt:record.updatedAt,actor:record.updatedBy,archived:record.archived});return Response.json({record,saved:true});
 }
 if(url.includes('?history='))return Response.json({history:audit[url.split('=')[1]]||[]});
 if(url.includes('/cad'))return Response.json({calls:[{id:'TEST-CAD-1',callType:'Fictional practice dispatch',address:'100 Test Way',city:'Fictional',units:'TEST1',dispatchedAt:'2026-09-29T10:00:00-05:00',source:'Local fixture',narrative:'Fictional source for UI testing only.'}]});
 return Response.json({departmentId:'fictional-local',records,members:[{id:'fictional-member',name:'Fictional, Member',rank:'Test'}],attachments:[]});
};
createRoot(document.getElementById('root')!).render(<><aside style={{background:'#fff0c4',padding:12}}>Fictional local test · no department writes <button onClick={()=>fail=true}>Fail next save</button></aside><main style={{maxWidth:1400,margin:'20px auto'}}><Workspace/></main></>);
