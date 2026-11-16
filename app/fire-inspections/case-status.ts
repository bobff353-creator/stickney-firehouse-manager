import {correctionClosesFinding,reportVersionVoided,type CaseSnapshot} from './case-workflow';
import type {InspectionRecord} from './model';
import type {InspectionReminder} from './reminders';

/** Current operational status overlays the issued report; it never edits it. */
export function currentCaseStatus(state:CaseSnapshot|null|undefined,record:InspectionRecord,checkId=''){
 const source=state?.reports.find(row=>row.inspectionId===record.id&&row.inspectionVersion===record.version);
 if(!state||!source)return {verified:false,voided:false};
 return {verified:Boolean(checkId&&state.cases.some(row=>correctionClosesFinding(row,record.id,record.version,checkId,source.payloadHash))),voided:Boolean(source.voided)||reportVersionVoided(state.actions,record.id,record.version,source.payloadHash)};
}
export function unresolvedInspectionReminders(reminders:InspectionReminder[],records:InspectionRecord[],state:CaseSnapshot|null|undefined){
 if(!state)return reminders;
 const byId=new Map(records.map(record=>[record.id,record]));
 return reminders.filter(reminder=>{const record=byId.get(reminder.recordId);if(!record)return true;const status=currentCaseStatus(state,record,reminder.checkId);return !status.voided&&!(reminder.kind==='Correction'&&status.verified);});
}
