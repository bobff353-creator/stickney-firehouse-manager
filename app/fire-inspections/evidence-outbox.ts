import {queueInspection,type PendingInspection} from './field-workflow';
import type {InspectionFile,InspectionRecord,InspectionSnapshot} from './model';
import type {QueuedInspectionPhoto} from './offline-evidence';

export type EvidenceFlow={phase:'stage'|'photos'|'finalize';targetStatus:InspectionRecord['data']['status'];stageRecord?:InspectionRecord;finalRecord?:InspectionRecord};
export type EvidencePendingInspection=PendingInspection&{evidenceFlow?:EvidenceFlow};
type PhotoReceipt={attachment:InspectionFile;record?:InspectionRecord;acceptedVersion?:number;replayed?:boolean};
export type EvidenceOutboxIO={
 save:(record:InspectionRecord)=>Promise<InspectionRecord>;
 upload:(photo:QueuedInspectionPhoto)=>Promise<PhotoReceipt>;
 photos:()=>QueuedInspectionPhoto[];
 persist:(rows:EvidencePendingInspection[])=>Promise<void>;
 snapshot:()=>Promise<InspectionSnapshot>;
 onSaved:(record:InspectionRecord)=>void;
 onPhotoAccepted:(photo:QueuedInspectionPhoto,receipt:PhotoReceipt)=>Promise<void>;
 onPhotoFailed:(photo:QueuedInspectionPhoto,state:'failed'|'conflict',message:string)=>Promise<void>;
 onComplete?:(request:InspectionRecord,saved:InspectionRecord)=>Promise<void>;
};
const canonical=(value:unknown):string=>Array.isArray(value)?'['+value.map(canonical).join(',')+']':value&&typeof value==='object'?'{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonical((value as Record<string,unknown>)[key])).join(',')+'}':JSON.stringify(value);
export function sameEvidenceContent(first:InspectionRecord,second:InspectionRecord){const left={...first.data,status:'In progress'},right={...second.data,status:'In progress'};return canonical(left)===canonical(right);}
const statusOf=(error:unknown)=>error&&typeof error==='object'&&'status' in error?Number(error.status):0;
const messageOf=(error:unknown)=>error instanceof Error?error.message:'The save was not confirmed. Exact local records and photos remain preserved.';
function confirmed(request:InspectionRecord,response:InspectionRecord){if(response.id!==request.id||response.kind!==request.kind||response.version!==request.version+1)throw Error('The server did not return the expected inspection version. Preserve the exact request and retry.');}

export function queueEvidenceInspection(rows:EvidencePendingInspection[],record:InspectionRecord,photos:QueuedInspectionPhoto[]):EvidencePendingInspection[]{
 const prior=rows.find(row=>row.record.id===record.id);
 const replaceStage=!!prior?.evidenceFlow?.stageRecord&&prior.evidenceFlow.targetStatus!=='Completed'&&record.version===prior.evidenceFlow.stageRecord.version;
 if(prior?.evidenceFlow?.stageRecord&&!replaceStage&&canonical(prior.record)!==canonical(record))throw Error('This inspection already has a confirmed evidence stage. Review the latest saved case before changing its frozen queued report.');
 const next=queueInspection(replaceStage?rows.filter(row=>row.record.id!==record.id):rows,record) as EvidencePendingInspection[];
 const hasPending=photos.some(photo=>photo.recordId===record.id);
 return next.map(row=>row.record.id===record.id?{...row,...(!replaceStage&&prior?.evidenceFlow?.stageRecord?{evidenceFlow:prior.evidenceFlow}:hasPending?{evidenceFlow:{phase:'stage',targetStatus:record.data.status} as EvidenceFlow}:{})}:row);
}

/** Exact stage/final requests and positive version receipts survive every checkpoint. */
export async function runEvidenceOutbox(initial:EvidencePendingInspection[],io:EvidenceOutboxIO,options:{onlyRecordId?:string;maxPhotos?:number}={}){
 let rows=[...initial],uploads=0;const savedRecords:InspectionRecord[]=[];let interrupted=false;
 const replace=async(row:EvidencePendingInspection)=>{rows=rows.map(old=>old.record.id===row.record.id?row:old);await io.persist(rows);};
 const finish=async(row:EvidencePendingInspection,saved:InspectionRecord)=>{rows=rows.filter(old=>old.record.id!==row.record.id);await io.persist(rows);io.onSaved(saved);savedRecords.push(saved);await io.onComplete?.(row.record,saved);};
 for(const initialRow of initial){
  if(options.onlyRecordId&&initialRow.record.id!==options.onlyRecordId||initialRow.state==='conflict')continue;
  let row=rows.find(current=>current.record.id===initialRow.record.id);if(!row)continue;
  try{
   const pendingPhotos=io.photos().filter(photo=>photo.recordId===row!.record.id);
   if(pendingPhotos.some(photo=>!row!.record.data.evidenceManifest.some(entry=>entry.id===photo.id&&(entry.checkId??'')===(photo.checkId??'')&&entry.sha256===photo.sha256&&entry.size===photo.size&&entry.contentType===photo.contentType&&entry.filename===photo.filename&&entry.caption===photo.caption)))throw Object.assign(Error('A queued photo is missing from the exact frozen inspection manifest. Preserve the original bytes and review the captured case before staging.'),{status:409});
   if(!row.evidenceFlow&&pendingPhotos.length){row={...row,evidenceFlow:{phase:'stage',targetStatus:row.record.data.status}};await replace(row);}
   if(!row.evidenceFlow){const saved=await io.save(row.record);confirmed(row.record,saved);await finish(row,saved);continue;}
   let flow=row.evidenceFlow;
   if(flow.phase==='stage'){
    const stageRequest:InspectionRecord={...row.record,data:{...row.record.data,status:'In progress'}};
    const saved=await io.save(stageRequest);confirmed(stageRequest,saved);io.onSaved(saved);
    flow={...flow,phase:'photos',stageRecord:saved};row={...row,state:'pending',error:'',evidenceFlow:flow};await replace(row);
   }
   if(!flow.stageRecord||flow.stageRecord.id!==row.record.id||flow.stageRecord.data.status!=='In progress')throw Object.assign(Error('The evidence-stage receipt is incomplete. Review the saved case before continuing.'),{status:409});
   if(flow.phase==='photos'){
    const held=io.photos().find(photo=>photo.recordId===row!.record.id&&photo.state==='conflict');
    if(held){await replace({...row,state:'failed',error:'A preserved photo requires explicit review before this signed report can continue.'});continue;}
    let paused=false;
    for(const photo of io.photos().filter(photo=>photo.recordId===row!.record.id)){
     if(uploads>=(options.maxPhotos??12)){paused=true;break;}
     try{
      const receipt=await io.upload(photo);
      if(!receipt.record||!sameEvidenceContent(flow.stageRecord!,receipt.record)||receipt.record.archived||receipt.record.data.status!=='In progress')throw Object.assign(Error('The saved inspection changed after staging. Its photo receipt is retained; review the latest case before issuing.'),{status:409});
      // The actual response version is authoritative. A manifest-aware upload
      // normally leaves it unchanged; legacy version increments remain explicit.
      flow={...flow,stageRecord:receipt.record};row={...row,evidenceFlow:flow};await replace(row);
      await io.onPhotoAccepted(photo,receipt);uploads++;
     }catch(error){await io.onPhotoFailed(photo,[400,404,409,422].includes(statusOf(error))?'conflict':'failed',messageOf(error));await replace({...row,state:'failed',error:'Photo upload is not confirmed: '+messageOf(error)});paused=true;interrupted=true;break;}
    }
    if(paused){if(interrupted)break;continue;}
    const fresh=await io.snapshot(),parent=fresh.records.find(record=>record.id===row!.record.id);
    if(!parent||parent.archived||!sameEvidenceContent(flow.stageRecord!,parent)||parent.version!==flow.stageRecord!.version)throw Object.assign(Error('The saved inspection changed before final issue. Review the latest case; the captured signed record remains queued.'),{status:409});
    const missing=row.record.data.evidenceManifest.some(entry=>!fresh.attachments.some(file=>file.id===entry.id&&file.recordId===row!.record.id&&(file.checkId??'')===(entry.checkId??'')&&file.size===entry.size&&file.contentType===entry.contentType&&file.filename===entry.filename&&file.caption===entry.caption));
    if(missing){await replace({...row,state:'failed',error:'A frozen evidence receipt is still missing. The signed report remains pending cloud issuance; restore or upload its exact original photo.'});continue;}
    if(flow.targetStatus==='In progress'){await finish(row,parent);continue;}
    const finalRecord:InspectionRecord={...flow.stageRecord!,data:{...flow.stageRecord!.data,status:flow.targetStatus}};
    flow={...flow,phase:'finalize',finalRecord};row={...row,state:'pending',error:'',evidenceFlow:flow};await replace(row);
   }
   if(flow.phase==='finalize'){
    if(!flow.finalRecord||flow.finalRecord.id!==row.record.id)throw Object.assign(Error('The frozen final request is unavailable. Preserve its captured report for recovery review.'),{status:409});
    const saved=await io.save(flow.finalRecord);confirmed(flow.finalRecord,saved);await finish(row,saved);
   }
  }catch(error){
   if(rows.some(current=>current.record.id===row!.record.id))await replace({...row,state:statusOf(error)===409?'conflict':'failed',error:messageOf(error)});
   if(![400,409,422].includes(statusOf(error))){interrupted=true;break;}
  }
 }
 return {rows,uploaded:uploads,savedRecords,interrupted,hasMore:rows.some(row=>row.state!=='conflict')};
}
