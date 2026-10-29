import {emptyInspection, freshCheck, normalizeInspection, validDate, type InspectionData, type InspectionRecord} from './model';
import {esoChecks, esoData, esoGuid, esoLabel, esoMedia, esoObject, esoRows, esoSummary, esoText, type EsoObject} from './eso-model';

export const esoRecordId = (id:string) => `eso-${id}`;
export const esoFileId = (inspectionId:string, attachmentId:string) => `eso-${inspectionId}-${attachmentId}`;
// ESO dates describe the department's local calendar day. Do not shift midnight through UTC.
export function esoDate(value:unknown) {
 const s=esoText(value), us=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s|$)/);
 const day=us?`${us[3]}-${us[1].padStart(2,'0')}-${us[2].padStart(2,'0')}`:s.slice(0,10);
 return validDate(day)&&!day.startsWith('0001-')?day:'';
}
export function esoTime(value:unknown){const s=esoText(value);return /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(s)?s.slice(0,5):'';}
export function esoDisplayDate(value:unknown){const day=esoDate(value);return day?new Intl.DateTimeFormat('en-US',{timeZone:'UTC',dateStyle:'medium'}).format(new Date(day+'T12:00:00Z')):'';}
export function esoDisplayTime(value:unknown){const time=esoTime(value);if(!time)return '';const [h,m]=time.split(':').map(Number);return `${h%12||12}:${String(m).padStart(2,'0')} ${h<12?'AM':'PM'}`;}
export function esoDisplayTimestamp(value:unknown){const s=esoText(value);if(!esoDate(s))return '';if(/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(s)&&!Number.isNaN(Date.parse(s)))return new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',year:'numeric',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(new Date(s));return [esoDisplayDate(s),esoDisplayTime(s.split(' ')[1])].filter(Boolean).join(' · ');}
export const esoStatus = (value:string):InspectionData['status'] => ({locked:'Completed',inprogress:'In progress',scheduled:'Scheduled',cancelled:'Canceled'} as const)[value as 'locked']||'Draft';
export function esoContactCards(b:EsoObject){
 return esoRows(esoData(b,'contacts').contacts).map(c=>({
  id:esoText(c.itemId), name:esoText(c.name), title:esoLabel(b,'contacts','NAMETITLELIST',c.titleId),
  roles:(Array.isArray(c.roleIds)?c.roleIds:[]).map(id=>esoLabel(b,'contacts','CONTACTROLELIST',id)).filter(Boolean),
  emails:esoRows(c.emails).map(e=>esoText(e.emailAddress)).filter(Boolean),
  phones:esoRows(c.phones).map(p=>({number:esoText(p.phoneNumber),type:esoLabel(b,'contacts','PHONETYPELIST',p.phoneTypeId)})).filter(p=>p.number),
  address:[c.address1,c.address2,c.address3,c.city,esoLabel(b,'contacts','NFIRS_STATE_U_S_TERRITORY_ABBREVIATIONS',c.stateId),c.zip].map(esoText).filter(Boolean).join(', '),
  note:esoText(c.note), primary:c.isPrimaryContact===true, emergency:c.isEmergencyContact===true,
 }));
}
function mappedChecks(b:EsoObject){
 const data=esoData(b,'inspectionCodes'),fireCodes=esoRows(esoObject(b.sourceCodes).fireCodes),sets=esoRows(esoObject(b.sourceCodes).fireCodeSets),violations=esoRows(data.violations),used=new Set<unknown>();
 const make=(answer:EsoObject,violation:EsoObject={},index=0)=>{
  const ref=fireCodes.find(c=>c.fireCodeId===answer.fireCodeId)||{},set=sets.find(s=>s.fireCodeSetId===ref.fireCodeSetId);
  const id=esoText(violation.violationId)||esoText(answer.inspectionChecklistFireCodeId)||esoText(answer.complianceId)||String(index);
  const c=freshCheck({id:`eso-check-${id}`,section:esoText(set?.name)||'Imported checklist',label:[ref.code,ref.title].map(esoText).filter(Boolean).join(' · ')||'Checkpoint (title not recorded)',source:esoText(ref.description)});
  c.result=violation.isResolved===true?'Resolved':answer.complianceState==='PASSED'?'Acceptable':answer.complianceState==='FAILED'||violation.violationId?'Needs attention':answer.complianceState==='NOTAPPLICABLE'?'Not applicable':'Not checked';
  c.location=esoText(violation.location);c.observation=esoText(violation.comments);c.code=esoText(ref.code);
  c.priority='';
  c.correction=esoText(violation.resolvedComments);c.correctedDate=esoDate(violation.resolvedDate);
  const additional=[esoText(violation.additionalComment),...esoRows(violation.additionalCommentsHistory).map(h=>[h.updatedAt,h.reinspectionNumber,h.historicalComment].map(esoText).filter(Boolean).join(' · '))].filter(Boolean);
  if(additional.length)c.observation=[c.observation,...additional].filter(Boolean).join('\n');
  return c;
 };
 const checks=esoChecks(b).flatMap((a,i)=>{const matches=violations.filter(v=>v.complianceId&&v.complianceId===a.complianceId);matches.forEach(v=>used.add(v.violationId));return matches.length?matches.map(v=>make(a,v,i)):[make(a,{},i)];});
 for(const v of violations.filter(v=>!used.has(v.violationId)))checks.push(make(v,v,checks.length));
 return checks;
}
export function nativeEsoInspection(b:EsoObject,sha256:string,importedAt:string,actor:string):InspectionRecord {
 const summary=esoSummary(b,importedAt),metadata=esoData(b,'metadata'),details=esoData(b,'details'),signatures=esoData(b,'signatures');
 if(!esoGuid(summary.inspectionId)||!/^[a-f0-9]{64}$/.test(sha256))throw Error('The saved source identity is invalid.');
 const d=emptyInspection(),contacts=esoContactCards(b),selected=contacts.find(c=>c.id===esoData(b,'contacts').selectedContactId)||contacts.find(c=>c.primary)||(contacts.length===1?contacts[0]:undefined),visits=esoRows(details.times),visit=visits[0];
 Object.assign(d,{title:summary.title,address:summary.address,type:summary.type,status:esoStatus(summary.status),checks:mappedChecks(b),sections:[],inspector:summary.inspector,contact:selected?.name||'',phone:selected?.phones.map(p=>p.number).join('; ')||'',email:selected?.emails[0]||'',scheduledDate:esoDate(details.scheduledDate),scheduledTime:esoTime(details.scheduledTime),actualDate:esoDate(visit?.inspectionDate),startTime:esoTime(visit?.startTime),endTime:esoTime(visit?.endTime),reason:esoText(details.complaintReason)||esoText(metadata.cancellationReason),others:(Array.isArray(details.otherInspectorIds)?details.otherInspectorIds:[]).map(id=>esoLabel(b,'details','INSPECTORS',id)).filter(Boolean).join(', ')});
 d.sections=[...new Set(d.checks.map(c=>c.section))];
 d.notes=esoRows(esoObject(b.notes).data).map(n=>[esoText(n.note),[n.updatedAt,n.updatedBy,n.isCarriedOver===true?'Carried over from '+(esoText(n.carriedOverFromLabel)||'an earlier inspection'):''].map(esoText).filter(Boolean).join(' · ')].filter(Boolean).join('\n')).join('\n\n');
 // Preserve a documented follow-up date without creating a new appointment or inventing a time.
 d.followUpDate=esoDate(signatures.reinspectionDate);d.nextDueDate=esoDate(signatures.nextEstimatedInspectionDate);d.reinspectionReason=esoText(signatures.reinspectionReason);
 d.importedSource={system:'ESO',inspectionId:summary.inspectionId,inspectionNumber:summary.inspectionNumber,status:summary.status,type:summary.type,sha256,importedAt,propertyId:esoText(metadata.propertyId)};
 // Historical lock/signature data is shown separately. Importing never creates a new attestation.
 return{id:esoRecordId(summary.inspectionId),kind:'inspection',data:normalizeInspection(d),version:1,archived:false,createdAt:importedAt,updatedAt:importedAt,updatedBy:actor};
}
export function nativeEsoFiles(b:EsoObject){
 const id=esoText(esoObject(b.index).inspectionId),violations=esoRows(esoData(b,'inspectionCodes').violations),notes=esoRows(esoObject(b.notes).data),contexts=esoRows(esoObject(b.importEvidence).contextImages);
 return esoMedia(b).map(m=>{
  const v=violations.find(v=>esoRows(v.attachments).some(a=>a.itemId===m.attachmentId)),attachment=v&&esoRows(v.attachments).find(a=>a.itemId===m.attachmentId),note=notes.find(n=>n.noteAttachmentId===m.attachmentId),context=contexts.find(c=>c.attachmentId===m.attachmentId);
  return{...m,id:esoFileId(id,m.attachmentId),recordId:esoRecordId(id),checkId:v?`eso-check-${esoText(v.violationId)}`:'',caption:esoText(attachment?.description)||esoText(note?.note)||esoText(context?.caption)||'',sourceDate:esoText(v?.createdAt)||esoText(note?.updatedAt)||'',reference:Boolean(context)};
 });
}
// Only values and user-facing labels are rendered. IDs, configuration and null values stay in the source backup.
export function readableEsoFields(b:EsoObject,tab:string,value:unknown,prefix=''):{label:string;value:string}[]{
 const configs=esoObject(esoObject(b[tab]).fieldConfigs),result:{label:string;value:string}[]=[];
 for(const [key,v]of Object.entries(esoObject(value))){
  if(v==null||v===''||Array.isArray(v)&&v.length===0||/Signature$|(^|_)id$|Id$|Ids$|image|url/i.test(key))continue;
  const config=esoObject(Object.entries(configs).find(([path])=>path.endsWith('.'+key))?.[1]),label=esoText(config.displayName)||key.replace(/([a-z])([A-Z])/g,'$1 $2').replace(/^./,c=>c.toUpperCase());
  if(typeof v==='object'){
   if(Array.isArray(v)){v.forEach((item,i)=>{if(item&&typeof item==='object')result.push(...readableEsoFields(b,tab,item,`${prefix}${label} ${i+1} · `));else if(esoText(item))result.push({label:prefix+label,value:esoText(item)});});}
   else result.push(...readableEsoFields(b,tab,v,prefix+label+' · '));
  }else result.push({label:prefix+label,value:typeof v==='boolean'?v?'Yes':'No':esoText(v)});
 }
 return result;
}
