import {validDate,type InspectionRecord} from './model';
import {inspectionReminders,type InspectionReminder} from './reminders';
import type {PropertyProfileData} from './property-profiles';
export type ReminderDraftPolicy={id:'inspection-reminder-policy';version:1;revision:number;enabled:boolean;draftOnly:true;timeZone:'America/Chicago';leadDays:number;repeatOverdueDays:number;includeAppointments:boolean;includeCorrections:boolean;recipients:'owner'|'contact'|'both';templateVersion:1;needsReview?:boolean;recoveryHold?:boolean;updatedAt?:string;updatedBy?:string};
export const defaultReminderDraftPolicy=():ReminderDraftPolicy=>({id:'inspection-reminder-policy',version:1,revision:0,enabled:true,draftOnly:true,timeZone:'America/Chicago',leadDays:2,repeatOverdueDays:7,includeAppointments:true,includeCorrections:true,recipients:'both',templateVersion:1});
export type ReminderFindingSource={inspectionId:string;inspectionVersion:number;payloadHash:string;checkId:string;caseKey:string;title:string;dueDate:string};
export type InspectionReminderDraft={id:string;status:'Draft';draftOnly:true;runId:string;runDate:string;to:string[];subject:string;text:string;source:{inspectionId:string;inspectionVersion:number;payloadHash:string;caseKey:string;trigger:'appointment'|'correction';dueDate:string;propertyId:string;operativeSources:ReminderFindingSource[]};createdAt:string;recoveryHold?:boolean;needsReview?:boolean};
export function normalizeReminderDraftPolicy(value:unknown,revision:number,actor:string,now:string):ReminderDraftPolicy{
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Review the reminder policy before saving.');const raw=value as Record<string,unknown>,policy=defaultReminderDraftPolicy();
 if(raw.draftOnly!==true||raw.timeZone!=='America/Chicago'||raw.version!==1||raw.templateVersion!==1)throw Error('This reminder worker only prepares drafts with the current Central-time templates.');
 for(const key of ['enabled','includeAppointments','includeCorrections'] as const){if(typeof raw[key]!=='boolean')throw Error('Choose valid reminder options.');policy[key]=raw[key];}
 if(!Number.isInteger(raw.leadDays)||Number(raw.leadDays)<0||Number(raw.leadDays)>30)throw Error('Choose 0–30 days for the advance reminder.');
 if(!Number.isInteger(raw.repeatOverdueDays)||Number(raw.repeatOverdueDays)<1||Number(raw.repeatOverdueDays)>90)throw Error('Choose 1–90 days between overdue reminders.');
 if(!['owner','contact','both'].includes(String(raw.recipients)))throw Error('Choose the owner, site contact or both.');
 if(raw.needsReview===true||raw.recoveryHold===true)throw Error('Review the recovered policy and explicitly clear its policy-review hold before saving.');
 return {...policy,leadDays:Number(raw.leadDays),repeatOverdueDays:Number(raw.repeatOverdueDays),recipients:raw.recipients as ReminderDraftPolicy['recipients'],revision,needsReview:false,recoveryHold:false,updatedAt:now,updatedBy:actor};
}
export function reminderLocalClock(now=new Date()){const date=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).format(now),hour=Number(new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',hour:'2-digit',hourCycle:'h23'}).format(now));return {date,hour};}
export function reminderDateEligible(due:string,date:string,policy:ReminderDraftPolicy,correction=false){if(!validDate(due)||!validDate(date))return false;const days=Math.round((Date.parse(due+'T12:00:00Z')-Date.parse(date+'T12:00:00Z'))/86400000);return correction?days<0&&(-days-1)%policy.repeatOverdueDays===0:days===0||policy.leadDays>0&&days===policy.leadDays||days<0&&(-days-1)%policy.repeatOverdueDays===0;}
export function candidateReminderFindings(records:InspectionRecord[],original:InspectionRecord,policy:ReminderDraftPolicy,date:string):InspectionReminder[]{
 if(!policy.includeCorrections||original.archived||original.data.test||original.data.status!=='Completed')return [];
 const keys=new Set(original.data.checks.map(check=>original.id+':'+check.id));
 return inspectionReminders(records,false,date).filter(item=>item.kind==='Correction'&&keys.has(item.id)&&reminderDateEligible(item.dueDate,date,policy,true));
}
export function draftRecipients(profile:Partial<PropertyProfileData>|undefined,inspection:InspectionRecord,policy:ReminderDraftPolicy){
 if(profile?.remindersOptOut)return {emails:[],reason:'opt-out'};
 const values:string[]=[];if(policy.recipients!=='contact'&&!profile?.ownerRemindersOptOut&&profile?.ownerEmail)values.push(profile.ownerEmail);
 if(policy.recipients!=='owner'&&!profile?.contactRemindersOptOut)values.push(profile?.contactEmail||inspection.data.email||'');
 const emails=[...new Set(values.map(value=>value.trim().toLowerCase()).filter(value=>value.length<=254&&/^[^\s@<>;,]+@[^\s@<>;,]+\.[^\s@<>;,]+$/.test(value)))];
 return {emails,reason:emails.length?'':policy.recipients==='owner'&&profile?.ownerRemindersOptOut||policy.recipients==='contact'&&profile?.contactRemindersOptOut||policy.recipients==='both'&&profile?.ownerRemindersOptOut&&profile?.contactRemindersOptOut?'opt-out':'no-contact'};
}
export function reminderDraftWording(record:InspectionRecord,trigger:'appointment'|'correction',dueDate:string,findings:ReminderFindingSource[],date:string){
 const property=record.data.title||'Property',subject=((trigger==='correction'?'Correction follow-up: ':dueDate<date?'Inspection follow-up: ':'Inspection reminder: ')+property).replace(/[\r\n]/g,' ').slice(0,200);
 const detail=trigger==='correction'?'The following findings remain open after their recorded correction deadlines:\n'+findings.map(item=>'- '+item.title.slice(0,300)+' (due '+item.dueDate+')').join('\n')+'\nPlease contact the fire department to arrange verification. Evidence already supplied still requires department review.':record.data.scheduledDate?(dueDate<date?'The inspection appointment recorded for this property was ':'An inspection appointment is recorded for ')+dueDate+(record.data.scheduledTime?' at '+record.data.scheduledTime+' Central':'')+'. Please contact the fire department to confirm access or arrange the next action.':'The next '+(record.data.followUpKind==='reinspection'?'reinspection':'inspection')+' is recorded as due '+dueDate+'. An appointment has not been confirmed. Please contact the fire department to arrange it.';
 return {subject,text:[property,record.data.address,'',detail,'','This reminder does not extend a correction deadline, amend an issued report or certify compliance.'].join('\n')};
}
