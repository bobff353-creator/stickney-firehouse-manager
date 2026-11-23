import React from 'react';
import {createRoot} from 'react-dom/client';
import Workspace from '../../app/arrival/ui/workspace';
import {ArrivalAccess} from '../../app/arrival/access';
import {blankPlan,systemKeys,type PlanRecord} from '../../app/arrival/lib/preplan';
import '../../app/arrival/arrival.css';
const role=new URL(location.href).searchParams.get('role')||'reviewer';
const owner='fixture-preplan-audit-user';
for(const key of Object.keys(localStorage))if(key.startsWith('stickney-arrival-draft-'+owner+'-'))localStorage.removeItem(key);
const data={...blankPlan(),name:'Fictional training market',address:'100 Example Street',city:'Test City',region:'IL',addressConfirmed:true,occupancy:'Unknown',basement:'Unknown',entrance:'Unknown',hydrant:'Unknown',hydrantStatus:'Unknown',hazardStatus:'Unknown',systems:Object.fromEntries(systemKeys.map(key=>[key,{answer:'Unknown',location:''}]))} as ReturnType<typeof blankPlan>;
const now=new Date().toISOString();
const records:PlanRecord[]=[{id:'fixture-market',name:data.name,address:data.address,working:structuredClone(data),published:structuredClone(data),status:'published',revision:3,publishedRevision:2,publishedAt:now,updatedAt:now,createdAt:now},{id:'fixture-review',name:'Fictional review building',address:'200 Example Street',working:{...structuredClone(data),name:'Fictional review building',address:'200 Example Street'},published:null,status:'review',revision:1,publishedRevision:null,publishedAt:null,updatedAt:now,createdAt:now}];
let writes=0;
window.fetch=async(input,options)=>{
 const url=new URL(String(input),'http://fixture.test'),path=url.pathname;
 if(!path.startsWith('/api/arrival/'))throw Error('Fixture blocks external requests');
 if(options?.method&&options.method!=='GET'){
  const fail=document.getElementById('fixture-fail') as HTMLInputElement;
  const conflict=document.getElementById('fixture-conflict') as HTMLInputElement;
  if(fail?.checked){fail.checked=false;return Response.json({error:'Fictional save failed. Your device draft is kept.'},{status:503});}
  if(conflict?.checked){conflict.checked=false;return Response.json({error:'A newer version exists. Export your draft before opening the cloud copy.'},{status:409});}
  if(role==='reader')return Response.json({error:'Read-only access'},{status:403});
  const body=JSON.parse(String(options.body));
  let record=records.find(r=>r.id===path.split('/')[4]||r.id===body.id);
  if(path.endsWith('/transition')){if(!record)return Response.json({}, {status:404});if(body.revision!==record.revision)return Response.json({error:'A newer version exists.'},{status:409});record.status=body.action==='submit'?'review':body.action==='publish'?'published':'draft';if(body.action==='publish'){record.published=structuredClone(record.working);record.publishedRevision=record.revision;}}
  else if(path==='/api/arrival/plans'||path.startsWith('/api/arrival/plans/')){
   if(record&&body.revision!==record.revision)return Response.json({error:'A newer version exists.'},{status:409});
   if(record){record.working=structuredClone(body.data);record.revision++;record.name=body.data.name;record.address=body.data.address;record.updatedAt=new Date().toISOString();record.status='draft';}
   else{record={id:body.id,name:body.data.name,address:body.data.address,working:body.data,published:null,status:'draft',revision:1,publishedRevision:null,publishedAt:null,updatedAt:now,createdAt:now};records.push(record);}
  }else return Response.json({error:'Unsupported fixture write'},{status:400});
  writes++;const counter=document.getElementById('fixture-writes');if(counter)counter.textContent=String(writes);
  return Response.json({plan:record});
 }
 if(path==='/api/arrival/plans')return Response.json({plans:role==='reader'?records.filter(r=>r.published):records});
 if(path.startsWith('/api/arrival/plans/'))return Response.json({plan:records.find(r=>r.id===path.split('/')[4]),events:[]});
 if(path==='/api/arrival/hydrants')return Response.json({hydrants:[],limited:false});
 if(path.startsWith('/api/arrival/observations'))return Response.json({observations:[],limited:false});
 return Response.json({error:'Unknown fictional request: '+path},{status:404});
};
const grants=['field_preplans.view',...(role==='reader'?[]:['field_preplans.edit','field_preplans.manage_attachments']),...(role==='reviewer'?['field_preplans.review','field_preplans.publish']:[])];
createRoot(document.getElementById('root')!).render(<main id="portal-workspace"><aside style={{padding:10,background:'#fff3c4',color:'#17253a'}}>Fictional local workflow · role: {role} · saved requests: <span id="fixture-writes">0</span><label><input type="checkbox" id="fixture-fail"/>Fail next save</label><label><input type="checkbox" id="fixture-conflict"/>Conflict next save</label></aside><ArrivalAccess.Provider value={new Set(grants)}><div className="arrival-app" data-theme="light"><Workspace user={{id:owner,name:'Fictional reviewer'}}/></div></ArrivalAccess.Provider></main>);
