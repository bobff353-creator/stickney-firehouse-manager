import React from 'react';
import {createRoot} from 'react-dom/client';
import TrainingWorkspace from '../../app/training/workspace';
import {normalizeTrainingData,validateTraining,type TrainingRecord} from '../../app/training/model';
if(!['127.0.0.1','localhost'].includes(location.hostname))throw Error('Fictional fixture is local only.');
let records:TrainingRecord[]=JSON.parse(sessionStorage.getItem('training-fixture')??'[]'),fail=false;
const members=[{id:'fictional-member',name:'Preview, Firefighter',rank:'Firefighter',active:1},{id:'fictional-officer',name:'Preview, Officer',rank:'Lieutenant',active:1}];
window.fetch=async(input,options)=>{
 const path=String(input);if(!path.startsWith('/api/training'))return Response.json({error:'Unexpected fixture call'},{status:400});
 if(options?.method==='POST') {
  if(fail){fail=false;return Response.json({error:'Simulated connection failure. Your draft is kept.'},{status:503});}
  const body=JSON.parse(String(options.body)),current=records.find(r=>r.id===body.id);
  if((current?.version??0)!==body.version)return Response.json({error:'Record changed in another tab.'},{status:409});
  try{const data=normalizeTrainingData(body.data);validateTraining(body.kind,data,records,members);const record={...body,data,version:body.version+1,updatedAt:new Date().toISOString(),createdAt:current?.createdAt??new Date().toISOString(),updatedBy:'fixture-owner@example.invalid'};records=[record,...records.filter(r=>r.id!==record.id)];sessionStorage.setItem('training-fixture',JSON.stringify(records));return Response.json({saved:true,record});}catch(e){return Response.json({error:String(e)},{status:400});}
 }
 if(path.includes('?history='))return Response.json({history:[]});
 return Response.json({records,members,attachments:[]});
};
createRoot(document.getElementById('root')!).render(<><aside style={{padding:10,background:'#fff0cf',color:'#4e3912',fontFamily:'sans-serif'}}>Fictional local verification · no department writes <button onClick={()=>{fail=true;}}>Fail next save</button></aside><main style={{maxWidth:1200,margin:'20px auto',fontFamily:'system-ui'}}><TrainingWorkspace/></main></>);
