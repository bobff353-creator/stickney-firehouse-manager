import { shiftDate, validDate, type TrainingRecord, type TrainingSnapshot } from './model';
export const documentTypes = ['SOG','SOP','Policy','Form','Manual','Bulletin','Certificate','Other'];
export function nextAssignmentData(record: TrainingRecord) {
  const data=record.data;
  if(record.kind!=='assignment'||record.archived||data.status!=='saved'||!data.repeatEveryDays||!validDate(data.dueDate))throw Error('Save an active assignment with repeat days before creating the next occurrence.');
  return {...data,dueDate:shiftDate(data.dueDate,data.repeatEveryDays),date:data.date?shiftDate(data.date,data.repeatEveryDays):'',seriesId:data.seriesId||record.id,assignmentId:'',credentialId:'',attendance:{},answers:{},verified:false,receipt:'',submissionDate:'',status:'saved' as const};
}
export function credentialRegister(snapshot: TrainingSnapshot, today: string, days: number, query='') {
  const through=shiftDate(today,days);
  return snapshot.records.filter(r=>r.kind==='credential'&&!r.archived&&!r.data.test&&r.data.status==='saved').map(record=>({
    record,member:snapshot.members.find(m=>m.id===record.data.employeeIds[0])?.name??'Member record unavailable',
    state:!record.data.dueDate?'Date needed':!validDate(record.data.dueDate)?'Date needs review':record.data.dueDate<today?'Past recorded renewal date':record.data.dueDate<=through?'Within reminder window':'Later',
    evidenceCount:snapshot.attachments.filter(a=>a.recordId===record.id).length,
  })).filter(row=>`${row.member} ${row.record.data.title} ${row.record.data.issuingAuthority}`.toLowerCase().includes(query.toLowerCase())).sort((a,b)=>(a.record.data.dueDate||'9999').localeCompare(b.record.data.dueDate||'9999')||a.member.localeCompare(b.member));
}
