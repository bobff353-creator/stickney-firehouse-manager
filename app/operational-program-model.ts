import {validQueueDate} from './task-queue-model.ts';
export const programKinds=['hydrants','outreach','replacement'] as const;
export type ProgramKind=typeof programKinds[number];
export type HydrantWork={hydrantId:string;work:'inspection'|'flushing';result:'pending'|'completed'|'follow_up';completedDate:string;notes:string;flushId:string};
export type ProgramData={title:string;date:string;status:'planned'|'completed'|'cancelled';ownerId:string;notes:string;items:HydrantWork[];audience:string;location:string;attendees:number|null;staffHours:number|null;equipmentId:string;reason:string;estimateCents:number|null;actualCents:number|null;costSource:string};
export type ProgramRecord={id:string;kind:ProgramKind;data:ProgramData;version:number;updatedAt:string;updatedBy:string};
export type ProgramSource={id:string;name:string;status?:string;expirationDate?:string;purchaseDate?:string;flushes?:{id:string;date:string}[]};
export type ProgramPacket={records:ProgramRecord[];canEdit:boolean;members:{id:string;name:string}[];sources:ProgramSource[];sourceState:'ready'|'unavailable';generatedAt:string};
export function blankProgram():ProgramData{return {title:'',date:'',status:'planned',ownerId:'',notes:'',items:[],audience:'',location:'',attendees:null,staffHours:null,equipmentId:'',reason:'',estimateCents:null,actualCents:null,costSource:''};}
const text=(x:unknown,n=2000)=>String(x??'').trim().slice(0,n);
function number(x:unknown,max:number,integer=false):number|null{if(x===null||x===undefined||x==='')return null;const n=Number(x);if(!Number.isFinite(n)||n<0||n>max||(integer&&!Number.isInteger(n)))throw Error('Enter a valid nonnegative number.');return n;}
export function normalizeProgram(value:unknown):ProgramData{
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Enter program details.');const v=value as Record<string,unknown>;
  if(!['planned','completed','cancelled'].includes(String(v.status)))throw Error('Choose a program status.');
  const items=Array.isArray(v.items)?v.items:[];if(items.length>250)throw Error('Limit each batch to 250 work items.');
  return {title:text(v.title,160),date:text(v.date,10),status:v.status as ProgramData['status'],ownerId:text(v.ownerId,100),notes:text(v.notes),items:items.map(raw=>{if(!raw||typeof raw!=='object')throw Error('Invalid hydrant work.');const i=raw as Record<string,unknown>;if(!['inspection','flushing'].includes(String(i.work))||!['pending','completed','follow_up'].includes(String(i.result)))throw Error('Choose hydrant work and result.');return {hydrantId:text(i.hydrantId,100),work:i.work as HydrantWork['work'],result:i.result as HydrantWork['result'],completedDate:text(i.completedDate,10),notes:text(i.notes),flushId:text(i.flushId,100)};}),audience:text(v.audience,160),location:text(v.location,240),attendees:number(v.attendees,1000000,true),staffHours:number(v.staffHours,1000000),equipmentId:text(v.equipmentId,100),reason:text(v.reason),estimateCents:number(v.estimateCents,100000000000,true),actualCents:number(v.actualCents,100000000000,true),costSource:text(v.costSource,240)};
}
export function validateProgram(kind:ProgramKind,d:ProgramData,sources:ProgramSource[],members:{id:string}[],current?:ProgramData){
  if(!d.title||!validQueueDate(d.date))throw Error('A title and valid scheduled/event date are required.');
  if(d.ownerId&&!members.some(m=>m.id===d.ownerId)&&d.ownerId!==current?.ownerId)throw Error('Choose a saved department member.');
  if(kind==='hydrants'){
    if(!d.items.length)throw Error('Select at least one hydrant work item.');const seen=new Set<string>();
    for(const item of d.items){const key=item.hydrantId+':'+item.work;if(seen.has(key))throw Error('A hydrant can appear once per work type in a batch.');seen.add(key);const source=sources.find(s=>s.id===item.hydrantId);if(!source)throw Error('A linked hydrant is unavailable. Reload its saved source before saving.');
      const prior=current?.items.find(i=>i.hydrantId===item.hydrantId&&i.work===item.work);if(source.status==='archived'&&!prior)throw Error('Archived hydrants cannot be added to a batch.');
      if(item.result!=='pending'){if(!validQueueDate(item.completedDate)||!item.notes)throw Error('Completed and follow-up work needs a valid work date and findings.');if(item.completedDate>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago'}).format(new Date()))throw Error('Completed work cannot have a future work date.');
        if(item.completedDate<d.date)throw Error('Work evidence must be on or after the scheduled date. Correct the scheduled date for work done early.');
        if(item.work==='flushing'&&!source.flushes?.some(f=>f.id===item.flushId&&f.date===item.completedDate))throw Error('Link a saved flushing record with the same work date.');}
      else if(item.flushId||item.completedDate)throw Error('Pending work cannot contain completion evidence.');
    }
    if(current?.items.some(old=>!d.items.some(i=>i.hydrantId===old.hydrantId&&i.work===old.work)))throw Error('Saved batch work cannot be removed. Cancel the batch or retain its work history.');
    if(d.status==='completed'&&d.items.some(i=>i.result!=='completed'))throw Error('Complete all work items before completing the batch. Follow-ups remain open.');
  }
  if(kind==='outreach'&&(!d.audience||!d.location))throw Error('Enter the audience and event location.');
  if(kind==='outreach'&&d.status==='completed'&&(d.attendees===null||d.staffHours===null))throw Error('Completed outreach needs recorded attendance and staff hours, including a real zero when applicable.');
  if(kind==='replacement'){
    if(!sources.some(s=>s.id===d.equipmentId))throw Error('Choose a saved department equipment record.');
    if(!d.reason)throw Error('Record the reason for replacement review.');
    if((d.estimateCents!==null||d.actualCents!==null)&&!d.costSource)throw Error('Record the quote, invoice, or source of entered costs.');
    if(d.status==='completed'&&d.actualCents===null)throw Error('Completed replacement needs its recorded actual cost.');
    if(current?.equipmentId&&d.equipmentId!==current.equipmentId)throw Error('A saved replacement plan must retain its equipment link.');
  }
}
export function csvCell(value:unknown){const v=String(value??'');return '"'+(/^[\s\u0000-\u001f]*[=+@-]/.test(v)?"'"+v:v).replaceAll('"','""')+'"';}
export function programCsv(kind:ProgramKind,records:ProgramRecord[],sources:ProgramSource[],generatedAt:string){
  const rows:unknown[][]=[['Snapshot',generatedAt],['Kind',kind],['Costs','Entered amounts only; blank means unknown; no service-life estimates'],['Title','Date','Status','Member ID','Source ID','Source name','Work','Result','Work date','Saved flushing ID','Audience','Location','Attendees','Staff hours','Estimate dollars','Actual dollars','Cost source','Findings / reason','Record ID','Version']];
  for(const r of records){const d=r.data,base=[d.title,d.date,d.status,d.ownerId];if(kind==='hydrants')for(const i of d.items)rows.push([...base,i.hydrantId,sources.find(s=>s.id===i.hydrantId)?.name||'Source unavailable',i.work,i.result,i.completedDate,i.flushId,'','','','','','','',i.notes,r.id,r.version]);else rows.push([...base,d.equipmentId,sources.find(s=>s.id===d.equipmentId)?.name||'','','','','',d.audience,d.location,d.attendees,d.staffHours,d.estimateCents===null?'':(d.estimateCents/100).toFixed(2),d.actualCents===null?'':(d.actualCents/100).toFixed(2),d.costSource,d.reason||d.notes,r.id,r.version]);}return '\ufeff'+rows.map(row=>row.map(csvCell).join(',')).join('\r\n');
}
