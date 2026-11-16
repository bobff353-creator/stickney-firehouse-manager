import {followUpId,type InspectionRecord} from './model';

export type FollowUpReview = {
 type:'routine'|'reinspection';id:string;existingDate:string;requestedDate:string;
 existingTime:string;requestedTime:string;status:InspectionRecord['data']['status'];
 archived:boolean;requested:boolean;
};

// A reissued report never silently overwrites a separately saved follow-up.
// Compare routine due dates separately from its eventual appointment date.
export function followUpReview(parent:InspectionRecord,records:readonly InspectionRecord[]):FollowUpReview[]{
 if(parent.kind!=='inspection'||parent.data.status!=='Completed')return[];
 const result:FollowUpReview[]=[];
 for(const type of ['routine','reinspection'] as const){
  const child=records.find(record=>record.id===followUpId(parent.id,type)&&record.kind==='inspection'&&record.data.parentId===parent.id&&record.data.followUpKind===type);
  if(!child)continue;
  const requestedDate=type==='routine'?(parent.data.repeatMonths?parent.data.nextDueDate:''):(parent.data.reinspectionDecision==='Not needed'?'':parent.data.followUpDate);
  const requested=Boolean(requestedDate)||type==='reinspection'&&parent.data.reinspectionDecision==='Needs scheduling';
  const existingDate=type==='routine'?(child.data.nextDueDate||child.data.scheduledDate):(child.data.scheduledDate||child.data.nextDueDate);
  const requestedTime=type==='reinspection'&&parent.data.reinspectionDecision==='Schedule'?parent.data.reinspectionTime:'';
  const existingTime=type==='reinspection'?child.data.scheduledTime:'';
  if(!requested||child.archived||child.data.status==='Canceled'||existingDate!==requestedDate||requestedTime&&existingTime!==requestedTime)result.push({type,id:child.id,existingDate,requestedDate,existingTime,requestedTime,status:child.data.status,archived:child.archived,requested});
 }
 return result;
}
