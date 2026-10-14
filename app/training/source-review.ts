import {repeatedCompletionData,type TrainingData,type TrainingRecord,type TrainingSnapshot,type TrainingMember} from './model';
export function possibleTrainingDuplicates(data:TrainingData,records:TrainingRecord[],recordId:string){
  if(!data.date||!data.title.trim()||data.test)return [];
  return records.filter(r=>r.id!==recordId&&r.kind==='completion'&&!r.archived&&!r.data.test&&r.data.status==='completed'&&r.data.date===data.date&&r.data.title.trim().toLowerCase()===data.title.trim().toLowerCase()&&(!(r.data.startTime&&data.startTime)||r.data.startTime===data.startTime)&&(!(r.data.endTime&&data.endTime)||r.data.endTime===data.endTime)&&r.data.employeeIds.some(id=>data.employeeIds.includes(id)&&(r.data.attendance[id]??r.data.hours??0)>0&&(data.attendance[id]??data.hours??0)>0));
}
export function paperEvidence(data:TrainingData,snapshot:TrainingSnapshot,recordId:string){
  const root=data.evidenceRecordId||recordId;
  const source=snapshot.records.find(r=>r.id===root&&r.kind==='completion');
  if(data.evidenceRecordId&&(!source||source.data.test&&!data.test))return [];
  return snapshot.attachments.filter(f=>f.recordId===root&&(f.contentType==='application/pdf'||f.contentType.startsWith('image/')));
}
export function validateSourceReview(kind:string,data:TrainingData,snapshot:TrainingSnapshot,recordId:string){
  if(kind!=='completion'||data.status!=='completed')return;
  if(possibleTrainingDuplicates(data,snapshot.records,recordId).length&&!data.duplicateReviewNote.trim())throw Error('Possible duplicate training credit. Review the saved report and explain why this is a separate valid session, or keep a draft.');
  if(!data.paperSource)return;
  if(!data.sourceLabel.trim()||!data.sourcePage.trim())throw Error('Record the original sheet name and page or pages.');
  if(!data.description.trim())throw Error('Enter a short narrative supported by the original sheet.');
  if((!data.startTime||!data.endTime)&&!data.timeNote.trim())throw Error('Explain the documented duration and any missing historical clock times. Never guess times.');
  if(!paperEvidence(data,snapshot,recordId).length)throw Error('Attach the original PDF or photo before completing this paper report. Save a draft to attach it.');
  if(!data.sourceRoster.length||data.sourceRoster.some(row=>row.resolution==='unresolved'))throw Error('Resolve the source roster before completing. Unknown handwriting and ID mismatches remain in draft.');
  const matched=data.sourceRoster.filter(row=>row.resolution==='matched');
  if(data.sourceRoster.some(row=>!row.name.trim()))throw Error('Preserve each source row name or an explicit unreadable-row description.');
  if(data.sourceRoster.some(row=>row.resolution==='excluded'&&!row.note.trim()))throw Error('Explain crossed-out rows and attendees assigned to another session.');
  if(matched.some(row=>!snapshot.members.some(m=>m.id===row.employeeId)))throw Error('Each confirmed source match needs a saved department member ID.');
  if(matched.some(row=>!row.note.trim()))throw Error('Record how each member match was verified, especially different IDs or unclear handwriting.');
  if(new Set(matched.map(row=>row.employeeId)).size!==matched.length)throw Error('Two source rows match the same member. Resolve the duplicate roster rows.');
  if(matched.length!==data.employeeIds.length||matched.some(row=>!data.employeeIds.includes(row.employeeId)))throw Error('Attendance must match the confirmed source roster for this session.');
  if(!data.sourceReviewVerified)throw Error('Review the actual session date, attendance, narrative, objectives and original evidence before completing.');
}
export function separateSourceSession(record:TrainingRecord):Partial<TrainingData>{
  return {...repeatedCompletionData(record.data),paperSource:true,sourceLabel:record.data.sourceLabel,sourceHeaderDate:record.data.sourceHeaderDate,sourcePage:record.data.sourcePage,evidenceRecordId:record.data.evidenceRecordId||record.id,hours:null,sourceRoster:[],sourceReviewVerified:false,duplicateReviewNote:''};
}
export function sourceMatchLabel(member:TrainingMember){return `${member.name} · ${member.id}${member.active?'':' · Former / inactive'}`;}
