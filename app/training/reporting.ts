import {validDate,todayChicago,creditedHours,csvCell,type TrainingRecord,type TrainingSnapshot} from './model';
import {paperEvidence} from './source-review';
import {taskReference,bookKey} from './osfm-selection';
export type ReportFilters={query:string;member:string;category:string;period:'all'|'this_month'|'last_month'|'custom';from:string;to:string;state:'completed'|'drafts'|'all';includeArchived:boolean;includeTests:boolean};
export type SavedReportView={id:string;name:string;filters:ReportFilters;version:number;archived:boolean;updatedAt:string};
export const defaultReportFilters=():ReportFilters=>({query:'',member:'',category:'',period:'all',from:'',to:'',state:'completed',includeArchived:false,includeTests:false});
export function normalizeReportFilters(input:unknown):ReportFilters{
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Choose report filters.');const raw=input as Record<string,unknown>,d=defaultReportFilters();
 for(const key of ['query','member','category','from','to'] as const)d[key]=String(raw[key]??'').trim().slice(0,key==='query'?240:160);
 if(!['all','this_month','last_month','custom'].includes(String(raw.period))||!['completed','drafts','all'].includes(String(raw.state)))throw Error('Choose a report period and state.');d.period=raw.period as ReportFilters['period'];d.state=raw.state as ReportFilters['state'];d.includeArchived=raw.includeArchived===true;d.includeTests=raw.includeTests===true;
 if(d.from&&!validDate(d.from)||d.to&&!validDate(d.to))throw Error('Enter valid report dates.');if(d.from&&d.to&&d.from>d.to)throw Error('Report through date must follow its start.');return d;
}
export function reportRange(filters:ReportFilters,today=todayChicago()){
 if(filters.period==='custom')return {from:filters.from,to:filters.to};if(filters.period==='all')return {from:'',to:''};
 const date=new Date(today+'T12:00:00Z');date.setUTCDate(1);if(filters.period==='last_month')date.setUTCMonth(date.getUTCMonth()-1);const from=date.toISOString().slice(0,10);date.setUTCMonth(date.getUTCMonth()+1);date.setUTCDate(0);return {from,to:filters.period==='this_month'?today:date.toISOString().slice(0,10)};
}
export function filteredTraining(snapshot:TrainingSnapshot,filters:ReportFilters,today=todayChicago()){
 const range=reportRange(filters,today),needle=filters.query.toLowerCase();return snapshot.records.filter(r=>r.kind==='completion'&&(filters.includeArchived||!r.archived)&&(filters.includeTests||!r.data.test)&&(filters.state==='all'||r.data.status===(filters.state==='drafts'?'draft':'completed'))&&(!filters.member||r.data.employeeIds.includes(filters.member))&&(!filters.category||r.data.category===filters.category)&&(!range.from||r.data.date>=range.from)&&(!range.to||r.data.date<=range.to)&&[r.data.title,r.data.description,r.data.category,...r.data.employeeIds.map(id=>snapshot.members.find(m=>m.id===id)?.name||id)].join(' ').toLowerCase().includes(needle)).sort((a,b)=>b.data.date.localeCompare(a.data.date)||a.id.localeCompare(b.id));
}
export function officialTraining(records:TrainingRecord[]){return records.filter(r=>r.kind==='completion'&&!r.archived&&!r.data.test&&r.data.status==='completed');}
export function evidenceSummary(record:TrainingRecord,snapshot:TrainingSnapshot){
 const files=record.data.paperSource?paperEvidence(record.data,snapshot,record.id):snapshot.attachments.filter(f=>f.recordId===record.id);
 return {files,source:record.data.paperSource?record.data.sourceLabel||'Source name missing':'Standard training record',review:record.data.paperSource?record.data.sourceReviewVerified?'Author confirmed source review':'Source review not confirmed':'No paper-source attestation required',unresolved:record.data.sourceRoster?.filter(row=>row.resolution==='unresolved').length||0,selectedReferences:record.data.osfmTaskIds?.length||0,recordedFields:record.data.fields.filter(f=>record.data.answers[f.id]?.trim()).length};
}
export type CoverageRow={id:string;kind:string;label:string;state:string;recordIds:string[];memberIds:string[];answers:string[]};
export function objectiveCoverage(records:TrainingRecord[],member=''){
 const rows=new Map<string,CoverageRow>();
 for(const record of officialTraining(records)){
  const attendees=record.data.employeeIds.filter(id=>(!member||id===member)&&creditedHours(record,id)>0);if(!attendees.length)continue;
  function add(id:string,kind:string,label:string,state:string,answer=''){const row=rows.get(id)||{id,kind,label,state,recordIds:[],memberIds:[],answers:[]};row.recordIds=[...new Set([...row.recordIds,record.id])];row.memberIds=[...new Set([...row.memberIds,...attendees])];if(answer)row.answers=[...new Set([...row.answers,answer])];rows.set(id,row);}
  for(const id of record.data.osfmTaskIds||[]){const ref=taskReference(id),current=Boolean(ref&&record.data.osfmBookHashes?.[bookKey(ref.book)]===ref.book.sha256);add('osfm:'+id+':'+(record.data.osfmBookHashes?.[ref?bookKey(ref.book):'']||'unknown'),'OSFM training reference',current?ref!.label:id,current?'Selected in completed training':'Source edition needs review');}
  for(const field of record.data.fields){const answer=record.data.answers[field.id]?.trim();if(answer)add('field:'+(record.data.activityId||record.id)+':'+field.id+':'+field.label,'Recorded activity field',field.label,'Recorded answer; no inferred proficiency',answer);}
 }
 return [...rows.values()].sort((a,b)=>a.kind.localeCompare(b.kind)||a.label.localeCompare(b.label));
}
export function coverageCsv(rows:CoverageRow[],snapshot:TrainingSnapshot){return [['Type','Objective / reference','Meaning','Completed records','Credited members','Recorded answers','Record IDs','Member IDs'],...rows.map(r=>[r.kind,r.label,r.state,r.recordIds.length,r.memberIds.map(id=>snapshot.members.find(m=>m.id===id)?.name||id).join('; '),r.answers.join('; '),r.recordIds.join('; '),r.memberIds.join('; ')])].map(row=>row.map(csvCell).join(',')).join('\r\n');}
export function activityResults(records:TrainingRecord[],query:string,category:string,includeDrafts=false,includeArchived=false){return records.filter(r=>r.kind==='activity'&&(includeArchived||!r.archived)&&(includeDrafts||r.data.status!=='draft')&&(!category||r.data.category===category)&&[r.data.title,r.data.category,r.data.description].join(' ').toLowerCase().includes(query.toLowerCase())).sort((a,b)=>a.data.title.localeCompare(b.data.title)||a.id.localeCompare(b.id));}
