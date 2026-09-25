import {normalizeCode, codeLabel, type CodeSelection, type CodeEntry} from './codes';
import { inspectionChecks, starterSections, inspectionTypes } from './catalog';
export const resultOptions = ['Not checked', 'Acceptable', 'Needs attention', 'Corrected on site', 'Not applicable', 'Not inspected'] as const;
export type CheckResult = typeof resultOptions[number];
export type InspectionCheck = { id: string; section: string; label: string; source: string; result: CheckResult; location: string; observation: string; correction: string; code: string; dueDate: string; correctedDate: string; priority: string; citations: CodeSelection[] };
export type Signature = { name: string; role: string; state: 'Not requested' | 'Signed' | 'Declined' | 'Not present'; strokes: number[][][]; signedAt: string };
export type InspectionData = {
  title: string; address: string; propertyId: string; occupancy: string; owner: string; contact: string; phone: string; email: string;
  type: string; status: 'Draft' | 'Needs scheduling' | 'Scheduled' | 'In progress' | 'Completed' | 'Canceled';
  scheduledDate: string; scheduledTime: string; actualDate: string; startTime: string; endTime: string; inspector: string; others: string;
  reason: string; codeEdition: string; localAmendments: string; checks: InspectionCheck[]; sections: string[];
  notes: string; outcome: '' | 'No issues observed' | 'Corrections required' | 'Incomplete / no access';
  repeatMonths: number; nextDueDate: string; followUpDate: string; parentId: string; followUpKind: string;
  reinspectionDecision: string; reinspectionReason: string; reinspectionTime: string; codeBasis: CodeSelection[]; inspectorSignature: Signature; representative: Signature; inspectorAttested: boolean; changeReason: string; test: boolean;
};
export type InspectionRecord = { id: string; kind: 'inspection' | 'template'; data: InspectionData; version: number; archived: boolean; createdAt: string; updatedAt: string; updatedBy: string };
export type InspectionFile = { id: string; recordId: string; filename: string; size: number; contentType: string; createdAt: string; checkId?:string; caption?:string; codeId?:string; recordVersion?:number };
export type Property = { id: string; name: string; address: string };
export type InspectionSnapshot = { records: InspectionRecord[]; properties: Property[]; attachments: InspectionFile[]; departmentId?:string; codes?:CodeEntry[] };
export const todayChicago = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago' }).format(new Date());
export function validDate(s: string) { return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0,10) === s; }
export function addMonths(date: string, months: number) {
  if (!validDate(date)) return '';
  const d = new Date(`${date}T12:00:00Z`), day = d.getUTCDate(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + months);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth()+1, 0)).getUTCDate(); d.setUTCDate(Math.min(day,last)); return d.toISOString().slice(0,10);
}
export function blankSignature(): Signature { return {name:'',role:'',state:'Not requested',strokes:[],signedAt:''}; }
export function freshCheck(c: Pick<InspectionCheck,'id'|'section'|'label'|'source'>): InspectionCheck { return {...c,result:'Not checked',location:'',observation:'',correction:'',code:'',dueDate:'',correctedDate:'',priority:'Routine',citations:[]}; }
export function emptyInspection(): InspectionData { return { title:'',address:'',propertyId:'',occupancy:'',owner:'',contact:'',phone:'',email:'',type:inspectionTypes[0],status:'Draft',scheduledDate:'',scheduledTime:'',actualDate:'',startTime:'',endTime:'',inspector:'',others:'',reason:'',codeEdition:'',localAmendments:'',checks:inspectionChecks.filter(c=>starterSections.includes(c.section)).map(freshCheck),sections:[...starterSections],notes:'',outcome:'',repeatMonths:0,nextDueDate:'',followUpDate:'',parentId:'',followUpKind:'',codeBasis:[],reinspectionDecision:'',reinspectionReason:'',reinspectionTime:'',inspectorSignature:blankSignature(),representative:blankSignature(),inspectorAttested:false,changeReason:'',test:false }; }
const text=(v: unknown,max=4000)=>String(v??'').trim().slice(0,max);
export function normalizeInspection(value: unknown): InspectionData {
  if (!value || typeof value !== 'object') throw Error('Inspection details are missing.');
  const v=value as Record<string,unknown>, d=emptyInspection();
  for (const key of Object.keys(d) as (keyof InspectionData)[]) if (typeof d[key]==='string') (d as unknown as Record<string,unknown>)[key]=text(v[key]);
  d.title=text(v.title,240); d.test=v.test===true; d.inspectorAttested=v.inspectorAttested===true;
  d.repeatMonths=Number(v.repeatMonths??0); if(!Number.isInteger(d.repeatMonths)||d.repeatMonths<0||d.repeatMonths>120)throw Error('Choose a repeat interval from 0 to 120 months.');
  if(!['Draft','Needs scheduling','Scheduled','In progress','Completed','Canceled'].includes(d.status))throw Error('Choose a valid inspection status.');
  if(!inspectionTypes.includes(d.type))throw Error('Choose an inspection type.');
  if(!['','No issues observed','Corrections required','Incomplete / no access'].includes(d.outcome))throw Error('Choose a valid outcome.');
  d.sections=Array.isArray(v.sections)?[...new Set(v.sections.map(x=>text(x,100)))].slice(0,30):[];
  if(!Array.isArray(v.checks)||v.checks.length>200)throw Error('An inspection can contain up to 200 checkpoints.');
  d.checks=v.checks.map(item=>{if(!item||typeof item!=='object')throw Error('Invalid checkpoint.');const c=item as Record<string,unknown>;const next={} as InspectionCheck;for(const k of Object.keys(freshCheck({id:'',label:'',section:'',source:''})) as (keyof InspectionCheck)[]){if(k!=='citations')(next as unknown as Record<string,string>)[k]=text(c[k],k==='id'?100:4000);}next.citations=normalizeSelections(c.citations);if(!next.id||!next.label||!resultOptions.includes(next.result))throw Error('Each checkpoint needs a label and a valid result.');if(!['Routine','Urgent','Immediate action'].includes(next.priority))throw Error('Choose a valid finding priority.');return next;});
  if(new Set(d.checks.map(c=>c.id)).size!==d.checks.length)throw Error('Duplicate checkpoints are not allowed.');
  d.codeBasis=normalizeSelections(v.codeBasis);
  for(const key of ['representative','inspectorSignature'] as const){const s=(v[key]??{}) as Partial<Signature>;
  if(s.state&&!['Not requested','Signed','Declined','Not present'].includes(s.state))throw Error('Choose a valid signature status.');
  const strokes=Array.isArray(s.strokes)?s.strokes:[];
  if(strokes.length>100||strokes.reduce((n,stroke)=>n+(Array.isArray(stroke)?stroke.length:10001),0)>8000||strokes.some(stroke=>!Array.isArray(stroke)||stroke.some(p=>!Array.isArray(p)||p.length!==2||p.some(n=>typeof n!=='number'||!Number.isFinite(n)||n<0||n>1))))throw Error('The signature drawing is invalid or too large.');
  d[key]={name:text(s.name,200),role:text(s.role,160),state:s.state??'Not requested',strokes,signedAt:text(s.signedAt,50)};
  if(d[key].state!=='Signed'){d[key].strokes=[];d[key].signedAt='';}}
  if(!['','Schedule','Needs scheduling','Not needed'].includes(d.reinspectionDecision))throw Error('Choose a valid reinspection decision.');
  return d;
}
export function updateInspectionDetail<K extends keyof InspectionData>(d:InspectionData,key:K,value:InspectionData[K]):InspectionData {
 const signing=['representative','inspectorSignature','inspectorAttested'].includes(key);
 return {...d,[key]:value,representative:key==='representative'?value as Signature:signing?d.representative:blankSignature(),inspectorSignature:key==='inspectorSignature'?value as Signature:signing?d.inspectorSignature:blankSignature(),inspectorAttested:key==='inspectorAttested'?value as boolean:false};
}
export function findings(d:InspectionData){return d.checks.filter(c=>['Needs attention','Corrected on site'].includes(c.result));}
export function validateInspection(kind:InspectionRecord['kind'],d:InspectionData,today=todayChicago()) {
  if(!d.title)throw Error(kind==='template'?'Name this checklist.':'Enter a business or property name.');
  for(const s of [d.scheduledDate,d.actualDate,d.nextDueDate,d.followUpDate,...d.checks.flatMap(c=>[c.dueDate,c.correctedDate])])if(s&&!validDate(s))throw Error('Use a valid calendar date.');
  for(const t of [d.scheduledTime,d.startTime,d.endTime,d.reinspectionTime])if(t&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(t))throw Error('Use 24-hour time, such as 09:00 or 14:30.');
  if(d.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email))throw Error('Check the contact email address.');
  if(d.actualDate>today)throw Error('An actual inspection date cannot be in the future.');
  if(d.startTime&&d.endTime&&d.endTime<d.startTime)throw Error('End time must follow start time for this visit. Record an overnight visit separately.');
  for(const signature of [d.representative,d.inspectorSignature??blankSignature()])if(signature.state==='Signed'&&(!signature.name||!signature.strokes.some(stroke=>stroke.length>1)))throw Error('Enter the signer’s name and capture their drawn signature.');
  if(kind==='template'){if(d.status!=='Draft')throw Error('Checklists are saved as templates, not completed inspections.');return;}
  if(d.status==='Scheduled'&&!d.scheduledDate)throw Error('Choose the scheduled date, or save as Needs scheduling.');
  if(d.status!=='Completed')return;
  if(!d.actualDate||!d.inspector||!d.outcome||!d.inspectorAttested)throw Error('To finish, record the actual date, inspector, outcome, and your review acknowledgment.');
  const unchecked=d.checks.filter(c=>c.result==='Not checked');
  if(unchecked.length)throw Error(`${unchecked.length} checkpoints are unanswered. Inspect them or explicitly mark Not inspected / Not applicable.`);
  if(d.outcome==='No issues observed'&&(!d.checks.some(c=>c.result==='Acceptable'||c.result==='Corrected on site')||d.checks.some(c=>['Needs attention','Not inspected'].includes(c.result))))throw Error('This inspection cannot say No issues observed while there are open issues or uninspected items.');
  for(const c of findings(d)){
    if(!c.observation||!c.location)throw Error(`Add the observation and location for ${c.label}.`);
    if(c.result==='Corrected on site'&&(!c.correction||!c.correctedDate))throw Error(`Document the correction and date for ${c.label}.`);
  }
  if(d.checks.some(c=>c.result==='Needs attention')){if(!d.reinspectionDecision)throw Error('Choose what happens next for the failed items: Schedule, Needs scheduling, or Not needed with a reason.');if(d.reinspectionDecision==='Not needed'&&!d.reinspectionReason.trim())throw Error('Explain why no reinspection is needed.');}
  if(d.reinspectionDecision==='Schedule'&&(!d.followUpDate||!d.reinspectionTime))throw Error('Choose a reinspection date and appointment time.');
  if(d.repeatMonths&&!d.nextDueDate)throw Error('Review the next routine due date.');
  if(d.nextDueDate&&d.nextDueDate<=d.actualDate)throw Error('The next routine due date must be after this inspection.');
  if(d.followUpDate&&d.followUpDate<d.actualDate)throw Error('The reinspection date cannot precede this inspection.');
}
export function queueLabel(d:InspectionData,today=todayChicago()) {
  if(d.status==='Completed'||d.status==='Canceled')return d.status;
  if(d.status==='Draft')return 'Draft';
  const date=d.scheduledDate||d.nextDueDate;
  if(!date)return 'Needs scheduling';
  const days=Math.round((Date.parse(date)-Date.parse(today))/86400000);
  if(days<0)return 'Past due'; if(days===0)return 'Due today'; if(days<=7)return 'Due within 1 week'; if(days<=14)return 'Due within 2 weeks';
  return d.scheduledDate?'Scheduled':'Needs scheduling';
}
export function followUpRecord(parent:InspectionRecord,mode:'routine'|'reinspection',date:string):InspectionRecord {
  const p=parent.data,d=emptyInspection();
  for(const k of ['title','address','propertyId','occupancy','owner','contact','phone','email','inspector','codeEdition','localAmendments','test'] as const)(d as unknown as Record<string,unknown>)[k]=p[k];
  d.codeBasis=p.codeBasis||[];d.parentId=parent.id;d.followUpKind=mode;d.status='Needs scheduling';d.nextDueDate=date;d.type=mode==='reinspection'?'Reinspection':p.type;d.repeatMonths=mode==='routine'?p.repeatMonths:0;
  if(mode==='reinspection'&&p.reinspectionDecision==='Schedule'){d.scheduledDate=date;d.scheduledTime=p.reinspectionTime;d.status='Scheduled';}
  d.checks=(mode==='reinspection'?p.checks.filter(c=>c.result==='Needs attention'):p.checks).map(c=>({...freshCheck(c),citations:c.citations||[],code:c.code}));d.sections=[...new Set(d.checks.map(c=>c.section))];
  return{id:followUpId(parent.id,mode),kind:'inspection',version:0,archived:false,data:d,createdAt:'',updatedAt:'',updatedBy:''};
}
export function reportText(r:InspectionRecord) {
 const d=r.data;return ['FIRE INSPECTIONS · PRIVATE PILOT',`${d.test?'TEST / ':''}${d.title}`,d.address,`Record: ${r.id} · Type: ${d.type}`,`Status: ${d.status} · Version ${r.version}`,`Occupancy: ${d.occupancy||'Not recorded'} · Owner: ${d.owner||'Not recorded'}`,`Scheduled: ${d.scheduledDate||'Not set'} ${d.scheduledTime}`,`Visit times: ${d.startTime||'Not recorded'}–${d.endTime||'Not recorded'} · Additional inspectors: ${d.others||'None recorded'}`,`Reason: ${d.reason||'Not recorded'}`,`Visit: ${d.actualDate||'Not recorded'} · Inspector: ${d.inspector||'Not recorded'}`,`Outcome: ${d.outcome||'Not recorded'}`,`Code / edition: ${d.codeEdition||'Not verified'}`,`Selected code basis: ${(d.codeBasis||[]).map(codeLabel).join('; ')||'Not selected'}`,`Local amendments: ${d.localAmendments||'Not recorded'}`,`Contact: ${d.contact} · ${d.email} · ${d.phone}`, ...d.checks.map(c=>`${c.section} / ${c.label}: ${c.result}\nLocation: ${c.location||'Not recorded'}\nObservation: ${c.observation||'None recorded'}\nPriority: ${c.priority}\nCorrection: ${c.correction||'None recorded'} · Code: ${[c.code,...(c.citations||[]).map(codeLabel)].filter(Boolean).join('; ')||'Not verified'}\nDue: ${c.dueDate||'Not set'} · Corrected: ${c.correctedDate||'Not recorded'}`),`Notes: ${d.notes}`,`Next routine due: ${d.nextDueDate||'Not set'} · Reinspection due: ${d.followUpDate||'Not set'}`,`Representative acknowledgment: ${d.representative.state} · ${d.representative.name} · ${d.representative.role} · ${d.representative.signedAt||'Not signed'}`,`Inspector signature: ${d.inspectorSignature?.state||'Not requested'} · ${d.inspectorSignature?.name||''} · ${d.inspectorSignature?.signedAt||'Not signed'}`,`Reinspection decision: ${d.reinspectionDecision||'Not recorded'} ${d.reinspectionTime||''} · ${d.reinspectionReason||''}`,`Inspector review: ${d.inspectorAttested?'Acknowledged by saving owner':'Not acknowledged'}`,`Saved by ${r.updatedBy} at ${r.updatedAt}`,'Delivery status is recorded separately in the email history. Download or print is not delivery confirmation.'].join('\n\n');
}

export function normalizeSelections(value:unknown):CodeSelection[]{if(value==null)return [];if(!Array.isArray(value)||value.length>30)throw Error('Select up to 30 code references.');return value.map(v=>{if(!v||typeof v!=='object'||typeof v.id!=='string'||!Number.isInteger(v.version)||v.version<1)throw Error('Invalid saved code selection.');return {...normalizeCode(v),id:v.id,version:v.version};});}
export function followUpId(id:string,mode:'routine'|'reinspection'){const match=id.match(/^(.*)-(routine|reinspection)(?:-(\d+))?$/);return match&&match[2]===mode?`${match[1]}-${mode}-${Number(match[3]||1)+1}`:`${id}-${mode}`;}
