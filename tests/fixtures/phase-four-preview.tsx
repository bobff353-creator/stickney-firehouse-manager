import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {PoliciesPage} from '../../app/resource-pages';
import TrainingWorkspace from '../../app/training/workspace';
import {emptyDocumentState,normalizeDocument,type DocumentVersion} from '../../app/document-workflow';
import {emptyTrainingData,normalizeTrainingData,validateTraining,type TrainingRecord} from '../../app/training/model';
import {nextAssignmentData} from '../../app/training/phase-four';
import '../../app/globals.css';
import '../../app/remaining-bento.css';
if(!['localhost','127.0.0.1'].includes(location.hostname))throw Error('Local fictional fixture only.');
let state=emptyDocumentState(),manager=true,fail=false;
const versions:DocumentVersion[]=[],acks:Record<string,string>={};
let policy={id:'fixture-policy',title:'Local fictional policy',policyNumber:'F-1',category:'General',effectiveDate:'2026-10-05',body:'Original local fixture text. No department records are used.',status:'Active'};
const members=[{id:'fixture-member',name:'Local Fixture Member',active:1,rank:'Firefighter'}];
const training=(id:string,kind:TrainingRecord['kind'],data:Partial<TrainingRecord['data']>):TrainingRecord=>({id,kind,version:1,archived:false,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),updatedBy:'fixture',data:{...emptyTrainingData(),title:'Local fixture '+kind,status:'saved',employeeIds:['fixture-member'],...data}});
let records=[training('fixture-assignment','assignment',{date:'2026-10-01',dueDate:'2026-10-31',repeatEveryDays:30}),training('fixture-credential','credential',{dueDate:'2026-10-20',cycleStart:'2026-01-01',certificationId:'custom',issuingAuthority:'Local fixture issuer',renewalMonths:12}),training('fixture-reference','resource',{documentType:'SOG',sourceUrl:'https://example.invalid/reference.pdf',description:'Fictional document reference'})];
window.fetch=async(input,init)=>{
 const path=String(input),body=init?.method==='POST'?JSON.parse(String(init.body)):null;
 if(body&&fail){fail=false;return Response.json({error:'Simulated failed save. Draft retained.'},{status:503});}
 if(path.startsWith('/api/resources')){
  if(body){const content=normalizeDocument(body);if(state.revision!==body.revision)return Response.json({error:'Concurrent draft saved. Keep your edits.'},{status:409});if(!versions.length)versions.push({id:'legacy',number:0,legacy:true,content:normalizeDocument({...policy,documentType:'Policy'}),publishedAt:'',publishedBy:'',requiresAcknowledgement:false,recipients:[]});state={...state,draft:content,revision:crypto.randomUUID()};return Response.json({id:policy.id,saved:true});}
  return Response.json({items:[{...policy,workflow:{...state,draft:manager?state.draft:null}}],canEdit:manager});
 }
 if(path.startsWith('/api/document-workflow')){
  if(body){if(body.action==='acknowledge'){if(!body.attested)return Response.json({error:'Read the statement.'},{status:400});acks[state.publishedVersion]??=new Date().toISOString();}
   else if(!manager)return Response.json({error:'Denied'},{status:403});
   else if(body.action==='publish'&&state.draft){const content=state.draft,version={id:crypto.randomUUID(),number:versions.length,legacy:false,content,publishedAt:new Date().toISOString(),publishedBy:'fixture',requiresAcknowledgement:body.requiresAcknowledgement,recipients:members};versions.unshift(version);policy={...policy,...content};state={...state,draft:null,publishedVersion:version.id,publishedType:content.documentType,revision:crypto.randomUUID()};}
   else state={...state,archived:body.action==='archive',revision:crypto.randomUUID()};
   return Response.json({saved:true});}
  const current=versions.find(v=>v.id===state.publishedVersion);return Response.json({state:{...state,draft:manager?state.draft:null},versions:versions.map(v=>({...v,recipients:manager?v.recipients:[]})),canManage:manager,canAcknowledge:!!current?.requiresAcknowledgement,acknowledgement:acks[state.publishedVersion]?{acknowledgedAt:acks[state.publishedVersion]}:null,acknowledgementReport:current&&manager?members.map(m=>({employeeId:m.id,name:m.name,acknowledgedAt:acks[state.publishedVersion]??null})):[]});
 }
 if(path.startsWith('/api/training')){
  if(path.includes('?history'))return Response.json({history:[]});
  if(body){const current=records.find(r=>r.id===body.id);if(body.action==='repeatAssignment'&&current){const data=nextAssignmentData(current),id='fixture-next-'+data.dueDate;const existing=records.find(r=>r.id===id),record=existing??training(id,'assignment',data);if(!existing)records=[record,...records];return Response.json({record,created:!existing});}const data=normalizeTrainingData(body.data);validateTraining(body.kind,data,records,members);const record={...body,data,version:body.version+1,updatedAt:new Date().toISOString()};records=[record,...records.filter(r=>r.id!==record.id)];return Response.json({record,saved:true});}
  return Response.json({records,members,attachments:[]});
 }
 return Response.json({error:'Unexpected fixture call'},{status:400});
};
function Preview(){const [dark,setDark]=useState(false),[mode,setMode]=useState('Policies'),[key,setKey]=useState(0);return <main className={dark?'app-shell sidebar-collapsed':''} style={{display:'block',maxWidth:1200,margin:'auto',padding:16}}><p style={{background:'#fff2b0',color:'#111',padding:12}}>LOCAL FICTIONAL VERIFICATION · no production writes</p><div style={{display:'flex',gap:10,flexWrap:'wrap'}}><button onClick={()=>setDark(!dark)}>{dark?'Use light preview':'Use dark preview'}</button><button onClick={()=>setMode(mode==='Policies'?'Training':'Policies')}>Show {mode==='Policies'?'Training':'Policies'}</button><button onClick={()=>{manager=!manager;setKey(key+1);}}>Use {manager?'member':'manager'} preview</button><button onClick={()=>{fail=true;}}>Fail next save</button></div><div id="portal-workspace" className={dark?"workspace bento-rest":""} key={key}>{mode==='Policies'?<PoliciesPage/>:<TrainingWorkspace/>}</div></main>;}
createRoot(document.getElementById('root')!).render(<Preview/>);
