import books from './osfm-books.json';
import { certificationCatalog,OSFM_RULE_URL } from './osfm-catalog';
import { addYears,shiftDate,todayChicago,type TrainingRecord,type TrainingSnapshot } from './model';
export function credentialEvidence(record:TrainingRecord,records:TrainingRecord[]) {
  const entries=records.filter(r=>r.kind==='proficiency'&&!r.archived&&!r.data.test&&r.data.status==='saved'&&r.data.credentialId===record.id&&r.data.employeeIds[0]===record.data.employeeIds[0]&&r.data.date>=record.data.cycleStart&&(!record.data.dueDate||r.data.date<=record.data.dueDate));
  const reviewed=entries.filter(r=>r.data.verified&&r.data.result==='Proficient'&&r.data.evaluator&&r.data.sourceEdition===record.data.sourceEdition&&r.data.sourceUrl===record.data.sourceUrl);
  const done=new Set(reviewed.map(r=>r.data.jpr));
  const required=record.data.requiredJprs;
  return {entries,reviewed,documented:required.filter(j=>done.has(j)),missing:required.filter(j=>!done.has(j)),points:reviewed.reduce((sum,r)=>sum+(r.data.points??0),0)};
}
export function credentialTimeline(record:TrainingRecord,today=todayChicago()) {
  const due=record.data.dueDate,catalog=certificationCatalog.find(c=>c.id===record.data.certificationId);if(!due||record.data.method==='Initial certification'||!catalog||catalog.recertification==='not-listed')return null;
  const opens=addYears(due,-1),graceEnds=shiftDate(due,90);
  return {due,opens,graceEnds,notice90:shiftDate(due,-90),status:today<opens?'Outside application window':today<=due?'Application window open':today<=graceEnds?'Past due — verify grace eligibility':'Past grace — OSFM course review needed'};
}
export function osfmHandoff(record:TrainingRecord,snapshot:TrainingSnapshot) {
  if(record.kind!=='credential'||record.data.test||record.archived||record.data.status==='draft')throw new Error('Choose a saved, non-test credential to prepare an OSFM handoff.');
  const evidence=credentialEvidence(record,snapshot.records),catalog=certificationCatalog.find(c=>c.id===record.data.certificationId),book=books.find(b=>b.url===record.data.sourceUrl);
  if(!catalog)throw new Error('This is a department or external credential. OSFM handoff applies only to the Illinois certification catalog.');
  const warnings:string[]=[];
  if(!record.data.externalId)warnings.push('OSFM firefighter ID needs verification.');
  if(!record.data.credentialNumber)warnings.push('Certificate number needs verification.');
  const initial=record.data.method==='Initial certification';
  if(!initial&&!record.data.dueDate&&catalog?.recertification!=='not-listed')warnings.push('Official renewal date is missing.');
  if(!record.data.requiredJprs.length&&catalog?.recertification==='jpr')warnings.push('Applicable task list has not been selected and verified.');
  if(evidence.missing.length)warnings.push(`${evidence.missing.length} selected JPRs still need reviewed proficiency evidence.`);
  if(!initial&&catalog?.recertification==='points'&&evidence.points<100)warnings.push('Fewer than 100 documented investigator points.');
  if(initial)warnings.push('Initial certification requires separate prerequisite, course approval, and examination review; this package is not an application or approval.');
  warnings.push('Chief attestation and signed official evidence must be reviewed before submission.','This is a portable data package, not an OSFM-approved upload format. Nothing has been transmitted.');
  const relevant=[record.id,...evidence.entries.map(e=>e.id)];
  return {schemaVersion:'stickney.training-handoff.v1',generatedAt:new Date().toISOString(),destination:'Illinois OSFM / DPSE',delivery:{state:'not_connected',submitted:false,providerReceipt:null},source:{app:'Stickney Firehouse Manager',rule:OSFM_RULE_URL,ruleEffective:'2025-11-24',reviewedOn:'2026-09-24'},member:{employeeId:record.data.employeeIds[0],name:snapshot.members.find(m=>m.id===record.data.employeeIds[0])?.name??'',osfmId:record.data.externalId||null},credential:{...record,catalog,bookFingerprint:book?.sha256??null},proficiency:evidence.entries,attachments:snapshot.attachments.filter(f=>relevant.includes(f.recordId)).map(f=>({...f,downloadPath:`/api/training/files/${f.id}`})),warnings};
}
