import {normalizeInspection,type InspectionRecord} from './model';
export const inspectionDraftKey=(department:string)=>`firehouse:private-inspection-draft:${department}`;
export function readInspectionDraft(raw:string|null):{record:InspectionRecord;step:number}|null {
 if(!raw)return null;
 try{const b=JSON.parse(raw);if(Date.now()-b.time>24*60*60*1000||!Number.isFinite(b.time)||!b.record||!Number.isInteger(b.record.version)||b.record.version<0||!['inspection','template'].includes(b.record.kind)||typeof b.record.id!=='string')return null;return{record:{...b.record,data:normalizeInspection(b.record.data)},step:Math.max(0,Math.min(b.record.kind==='template'?1:4,Number(b.step)||0))};}catch{return null;}
}
