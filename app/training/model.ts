import { certificationCatalog } from './osfm-catalog';

export const trainingKinds = ['activity','completion','assignment','credential','proficiency','group','resource'] as const;
export type TrainingKind = typeof trainingKinds[number];
export type TrainingField = { id: string; label: string; type: 'text'|'number'|'date'|'choice'|'yes-no'; options: string[]; required: boolean };
export type TrainingData = {
  title: string; category: string; description: string; date: string; dueDate: string; startTime: string;
  hours: number | null; instructor: string; location: string; employeeIds: string[];
  activityId: string; assignmentId: string; credentialId: string; certificationId: string;
  status: 'draft'|'saved'|'completed'; delivery: string; sourceUrl: string; sourceEdition: string;
  externalId: string; cycleStart: string; issuedDate: string; credentialNumber: string;
  jpr: string; sourcePage: string; evaluator: string; method: string; result: string;
  points: number | null; pointsBasis: string; test: boolean; verified: boolean;
  fields: TrainingField[]; answers: Record<string,string>; attendance: Record<string,number>;
  requiredJprs: string[]; receipt: string; submissionDate: string; reviewNote: string;
};
export type TrainingRecord = { id: string; kind: TrainingKind; data: TrainingData; version: number; archived: boolean; createdAt: string; updatedAt: string; updatedBy: string };
export type TrainingMember = { id: string; name: string; rank: string; active: number };
export type TrainingAttachment = { id: string; recordId: string; filename: string; size: number; contentType: string; createdAt: string };
export type TrainingSnapshot = { records: TrainingRecord[]; members: TrainingMember[]; attachments: TrainingAttachment[] };
export const categories = ['Company training','Driver / operator','Officer development','EMS','Hazardous materials','Technical rescue','Fire prevention / inspection','Instructor development','Health and safety','Compliance','New member onboarding','Facility / live fire','Fire investigation','Communications','Traffic incident management','Mental health','Other'];
export const todayChicago = () => new Intl.DateTimeFormat('en-CA', { timeZone:'America/Chicago', year:'numeric',month:'2-digit',day:'2-digit' }).format(new Date());
export function emptyTrainingData(): TrainingData {
  return { title:'',category:'Company training',description:'',date:'',dueDate:'',startTime:'',hours:null,instructor:'',location:'',employeeIds:[],activityId:'',assignmentId:'',credentialId:'',certificationId:'',status:'draft',delivery:'Hands-on',sourceUrl:'',sourceEdition:'',externalId:'',cycleStart:'',issuedDate:'',credentialNumber:'',jpr:'',sourcePage:'',evaluator:'',method:'Training',result:'Practiced',points:null,pointsBasis:'',test:false,verified:false,fields:[],answers:{},attendance:{},requiredJprs:[],receipt:'',submissionDate:'',reviewNote:'' };
}
export function validDate(value: string) { const d=new Date(value+'T12:00:00Z');return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(d.getTime()) && d.toISOString().slice(0,10)===value; }
export function shiftDate(date: string, days: number) { const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10); }
export function addYears(date: string, years: number) { const d=new Date(date+'T12:00:00Z');const month=d.getUTCMonth();d.setUTCFullYear(d.getUTCFullYear()+years);if(d.getUTCMonth()!==month)d.setUTCDate(0);return d.toISOString().slice(0,10); }
export function safeLink(value: string) { try { const u=new URL(value); return u.protocol==='https:' && !u.username && !u.password; } catch { return false; } }
export function normalizeTrainingData(input: unknown): TrainingData {
  if(!input || typeof input!=='object' || Array.isArray(input))throw new Error('The training details are missing.');
  const raw=input as Record<string,unknown>, out=emptyTrainingData();
  for(const key of Object.keys(out) as (keyof TrainingData)[]) {
    if(typeof out[key]==='string') (out as unknown as Record<string,unknown>)[key]=String(raw[key]??'').trim().slice(0,key==='description'?12000:2000);
  }
  out.status=['draft','saved','completed'].includes(String(raw.status))?raw.status as TrainingData['status']:'draft';
  out.test=raw.test===true;out.verified=raw.verified===true;
  for(const key of ['hours','points'] as const) { const n=raw[key]; out[key]=n===null||n===undefined||n===''?null:Number(n); if(out[key]!==null && (!Number.isFinite(out[key]) || out[key]!<0 || out[key]!>10000))throw new Error(`Enter a valid ${key} value.`); }
  for(const key of ['employeeIds','requiredJprs'] as const) out[key]=[...new Set((Array.isArray(raw[key])?raw[key]:[]).map(String).map(s=>s.trim()).filter(Boolean))].slice(0,500);
  out.fields=(Array.isArray(raw.fields)?raw.fields:[]).slice(0,40).map((f:Record<string,unknown>)=>({id:String(f.id??'').slice(0,80),label:String(f.label??'').trim().slice(0,160),type:['text','number','date','choice','yes-no'].includes(String(f.type))?f.type as TrainingField['type']:'text',options:(Array.isArray(f.options)?f.options:[]).map(String).map(s=>s.trim().slice(0,120)).filter(Boolean).slice(0,50),required:f.required===true}));
  if(out.fields.some(f=>!f.id||!f.label||(f.type==='choice'&&!f.options.length))||new Set(out.fields.map(f=>f.id)).size!==out.fields.length)throw new Error('Each custom field needs a unique ID, label, and any selection options.');
  for(const [key,value] of Object.entries(raw.answers&&typeof raw.answers==='object'?raw.answers:{}).slice(0,40)) if(/^[a-zA-Z0-9_-]{1,80}$/.test(key))out.answers[key]=String(value??'').slice(0,2000);
  for(const [id,value] of Object.entries(raw.attendance&&typeof raw.attendance==='object'?raw.attendance:{}).slice(0,500)) {const n=Number(value);if(!Number.isFinite(n)||n<0||n>24)throw new Error('Attendance hours must be between 0 and 24.');out.attendance[id]=n;}
  for(const key of ['date','dueDate','cycleStart','issuedDate','submissionDate'] as const) if(out[key]&&!validDate(out[key]))throw new Error(`Enter a valid ${key.replace(/[A-Z]/g,m=>' '+m.toLowerCase())}.`);
  if(out.startTime&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(out.startTime))throw new Error('Enter time as HH:MM, from 00:00 to 23:59.');
  if(out.sourceUrl&&!safeLink(out.sourceUrl))throw new Error('Source links must start with https://.');
  if(out.certificationId&&out.certificationId!=='custom'&&!certificationCatalog.some(c=>c.id===out.certificationId))throw new Error('Choose a certification from the official catalog or Other credential.');
  return out;
}
export function validateTraining(kind: TrainingKind, data: TrainingData, records: TrainingRecord[], members: TrainingMember[], today=todayChicago()) {
  if(!data.title)throw new Error('Give this record a name.');
  if(data.test && data.title!=='test/training')throw new Error('Test records must be named test/training.');
  if(data.employeeIds.some(id=>!members.some(m=>m.id===id)))throw new Error('A selected member no longer exists. Reload the roster.');
  const linked=(id:string,k:TrainingKind)=>records.find(r=>r.id===id&&r.kind===k&&!r.archived);
  if(data.activityId&&!linked(data.activityId,'activity'))throw new Error('Select an available activity.');
  if(data.assignmentId&&!linked(data.assignmentId,'assignment'))throw new Error('Select an available assignment.');
  if(data.credentialId&&!linked(data.credentialId,'credential'))throw new Error('Select an available credential.');
  for(const [id,k] of [[data.activityId,'activity'],[data.assignmentId,'assignment'],[data.credentialId,'credential']] as const) if(id&&linked(id,k)?.data.test&&!data.test)throw new Error('A test activity, assignment, or credential cannot receive real credit.');
  if(kind==='assignment' && data.date && data.dueDate && data.dueDate<data.date)throw new Error('The due date cannot be before the start date.');
  if(kind==='credential' && data.cycleStart && data.dueDate && data.dueDate<data.cycleStart)throw new Error('The renewal date cannot be before the cycle begins.');
  if(data.status==='draft')return;
  if(['completion','assignment','credential','proficiency'].includes(kind)&&!data.employeeIds.length)throw new Error('Select at least one member.');
  if(['credential','proficiency'].includes(kind)&&data.employeeIds.length!==1)throw new Error('A credential or task entry belongs to one member.');
  if(kind==='completion') {
    if(!data.date||data.date>today)throw new Error('Choose the actual completion date, today or earlier.');
    if(data.hours===null||data.hours<=0||data.hours>24)throw new Error('Enter actual hours, greater than zero and no more than 24 per day.');
    if(!data.instructor)throw new Error('Enter the instructor or training provider.');
    if(data.employeeIds.some(id=>data.attendance[id]!==undefined&&data.attendance[id]>data.hours!))throw new Error('A member cannot receive more hours than the training duration.');
    const activity=linked(data.activityId,'activity');
    for(const f of activity?.data.fields??[]) {const answer=data.answers[f.id]?.trim()??'';if(f.required&&!answer)throw new Error(`Complete ${f.label}.`);if(answer&&f.type==='choice'&&!f.options.includes(answer))throw new Error(`Choose a listed answer for ${f.label}.`);if(answer&&f.type==='number'&&!Number.isFinite(Number(answer)))throw new Error(`Enter a number for ${f.label}.`);if(answer&&f.type==='date'&&!validDate(answer))throw new Error(`Enter a date for ${f.label}.`);if(answer&&f.type==='yes-no'&&!['Yes','No','Not applicable'].includes(answer))throw new Error(`Choose an answer for ${f.label}.`);}
    if(data.assignmentId) {const a=linked(data.assignmentId,'assignment')!;if(data.employeeIds.some(id=>!a.data.employeeIds.includes(id)))throw new Error('Only members on the linked assignment can receive completion credit.');if(a.data.activityId&&data.activityId!==a.data.activityId)throw new Error('The completion must use the assigned activity.');if(!data.test&&a.data.test)throw new Error('A test assignment cannot receive real credit.');}
  }
  if(kind==='assignment'&&!data.dueDate)throw new Error('Choose when this assignment is due.');
  if(kind==='credential'&&(!data.certificationId||!data.cycleStart))throw new Error('Choose a certification and the verified start of this credential cycle.');
  if(kind==='proficiency') {
    const c=linked(data.credentialId,'credential');
    if(!c||!data.jpr||!data.date||!data.sourceUrl||!data.sourcePage||!data.sourceEdition)throw new Error('Choose a credential and enter the JPR, performed date, source, edition, and page.');
    if(c.data.employeeIds[0]!==data.employeeIds[0])throw new Error('This task must belong to the credential holder.');
    if(c.data.certificationId!==data.certificationId)throw new Error('This task must use the credential’s certification level.');
    if(data.date>today||data.date<c.data.cycleStart||(c.data.dueDate&&data.date>c.data.dueDate))throw new Error('Use evidence performed within this credential cycle and no later than today.');
    if(data.result==='Proficient'&&(!data.evaluator||!data.verified))throw new Error('Proficiency needs the evaluator name and your evidence-review attestation.');
    if(data.points!==null&&!data.pointsBasis)throw new Error('Enter the official tally-sheet category and basis for these points.');
    if(records.some(r=>r.kind==='proficiency'&&!r.archived&&!r.data.test&&r.data.status==='saved'&&r.data.credentialId!==data.credentialId&&r.data.certificationId===data.certificationId&&r.data.employeeIds[0]===data.employeeIds[0]&&r.data.jpr===data.jpr&&r.data.date===data.date&&r.data.sourceUrl===data.sourceUrl))throw new Error('This dated JPR evidence is already in another credential cycle. It cannot be reused.');
  }
  if(kind==='resource'&&!data.sourceUrl&&!data.description)throw new Error('Add a resource link or a description before saving.');
}
export function creditedHours(record:TrainingRecord, employeeId?:string) {
  if(record.kind!=='completion'||record.archived||record.data.test||record.data.status!=='completed')return 0;
  const ids=employeeId?record.data.employeeIds.filter(id=>id===employeeId):record.data.employeeIds;
  return ids.reduce((sum,id)=>sum+(record.data.attendance[id]??record.data.hours??0),0);
}
export function assignmentProgress(record:TrainingRecord, records:TrainingRecord[]) {
  const complete=new Set(records.filter(r=>r.kind==='completion'&&!r.archived&&!r.data.test&&r.data.status==='completed'&&r.data.assignmentId===record.id).flatMap(r=>r.data.employeeIds.filter(id=>(r.data.attendance[id]??r.data.hours??0)>0)));
  return { completed:record.data.employeeIds.filter(id=>complete.has(id)).length,total:record.data.employeeIds.length };
}
export function deadlineLabel(due:string,today=todayChicago()) {
  if(!due)return 'Date needed';if(due<today)return 'Past due';if(due===today)return 'Due today';if(due<=shiftDate(today,7))return 'Due within 7 days';if(due<=shiftDate(today,14))return 'Due within 2 weeks';if(due<=shiftDate(today,90))return 'Due within 90 days';return 'Upcoming';
}
export function csvCell(value:unknown) { let s=String(value??'');if(/^[\s]*[=+@-]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"'; }
export function trainingCsv(records:TrainingRecord[], members:TrainingMember[]) {
  const rows:unknown[][]=[['Record ID','Training','Member','Date','Hours','Instructor / provider','Location','Category','Assignment ID','Source','Recorded by']];
  for(const r of records.filter(r=>r.kind==='completion'&&!r.archived&&!r.data.test&&r.data.status==='completed'))for(const id of r.data.employeeIds)rows.push([r.id,r.data.title,members.find(m=>m.id===id)?.name??id,r.data.date,r.data.attendance[id]??r.data.hours,r.data.instructor,r.data.location,r.data.category,r.data.assignmentId,r.data.sourceUrl,r.updatedBy]);
  return rows.map(row=>row.map(csvCell).join(',')).join('\r\n');
}
