import React from 'react';
import {createRoot} from 'react-dom/client';
import Workspace from '../../app/fire-inspections/workspace';
import {normalizeInspection,validateInspection,followUpRecord,type InspectionRecord} from '../../app/fire-inspections/model';
if(!['127.0.0.1','localhost'].includes(location.hostname))throw Error('Local fixture only.');
let records:InspectionRecord[]=JSON.parse(sessionStorage.getItem('inspection-fixture')||'[]'),fail=false;
const properties=[{id:'fictional-property',name:'Fictional practice property',address:'100 Test Way'}];
window.fetch=async(input,options)=>{
 if(!String(input).startsWith('/api/fire-inspections'))return Response.json({error:'Unexpected fixture request'},{status:400});
 if(options?.method==='POST'){
  if(fail){fail=false;return Response.json({error:'Simulated connection failure. Your draft is kept.'},{status:503});}
  const b=JSON.parse(String(options.body)),current=records.find(r=>r.id===b.id);
  if((current?.version??0)!==b.version)return Response.json({error:'Stale version'},{status:409});
  try{const data=normalizeInspection(b.data);validateInspection(b.kind,data);const record={...b,data,version:b.version+1,updatedAt:new Date().toISOString(),updatedBy:'fictional@example.invalid',createdAt:current?.createdAt||new Date().toISOString()};const followUps:InspectionRecord[]=[];if(data.status==='Completed')for(const[mode,date]of [['routine',data.repeatMonths?data.nextDueDate:''],['reinspection',data.followUpDate]]as const){if(date){const child=followUpRecord(record,mode,date);if(!records.some(r=>r.id===child.id))followUps.push({...child,version:1,createdAt:record.createdAt,updatedAt:record.updatedAt,updatedBy:record.updatedBy});}}records=[record,...followUps,...records.filter(r=>r.id!==b.id)];sessionStorage.setItem('inspection-fixture',JSON.stringify(records));return Response.json({saved:true,record,followUps});}catch(e){return Response.json({error:String(e)},{status:400});}
 }
 if(String(input).includes('?history='))return Response.json({history:[]});
 return Response.json({records,properties,attachments:[]});
};
createRoot(document.getElementById('root')!).render(<><aside style={{padding:10,background:'#fff0cc',fontFamily:'system-ui'}}>Fictional local inspection test · no department writes <button onClick={()=>{fail=true;}}>Fail next save</button></aside><main style={{padding:20,fontFamily:'system-ui'}}><Workspace/></main></>);
