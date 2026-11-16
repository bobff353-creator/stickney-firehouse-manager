import {normalizeInspection,type InspectionRecord} from './model';
export const inspectionDraftKey=(department:string)=>`firehouse:private-inspection-draft:${department}`;
export function readInspectionDraft(raw:string|null,options:{allowExpiredForReview?:boolean}={}):{record:InspectionRecord;step:number;expiredForReview?:true}|null {
 if(!raw)return null;
 try{const b=JSON.parse(raw),expired=Date.now()-b.time>7*86400000;if(expired&&!options.allowExpiredForReview||b.time>Date.now()+60000||!Number.isFinite(b.time)||!b.record||!Number.isInteger(b.record.version)||b.record.version<0||!['inspection','template'].includes(b.record.kind)||typeof b.record.id!=='string')return null;return{record:{...b.record,data:normalizeInspection(b.record.data)},step:Math.max(0,Math.min(b.record.kind==='template'?1:4,Number(b.step)||0)),...(expired?{expiredForReview:true as const}:{})};}catch{return null;}
}
