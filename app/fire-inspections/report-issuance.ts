import type {InspectionDb} from './server';
import type {ReportAction} from './case-workflow';

export type ReportVoidSource={actionId:string;inspectionVersion:number;payloadHash:string};
export type ReportIssuanceTarget={id:string;version:number};
type VoidRow={inspection_id:string;target_version:number;action_id:string;source_version:number;source_hash:string;payload_hash:string|null;source_status:string|null};
export const reportIssuanceKey=(id:string,version:number)=>id+':'+version;

/** Archive-only revisions inherit their issued report's void. A deliberate Draft
 * reopen starts a new issuance, whose later completion requires fresh review. */
export async function reportIssuanceVoids(db:InspectionDb,department:string,targets:ReportIssuanceTarget[],_actions?:ReportAction[]){
 void _actions;
 const unique=[...new Map(targets.map(target=>[reportIssuanceKey(target.id,target.version),target])).values()],result=new Map<string,ReportVoidSource>();
 for(const target of unique)if(!/^[A-Za-z0-9_-]{1,120}$/.test(target.id)||!Number.isSafeInteger(target.version)||target.version<1)throw Error('Choose a valid original report and version before checking its issuance.');
 // Read persisted notices in the same SQL snapshot as the lineage/fingerprints.
 // Caller-provided action arrays remain useful for display but cannot hide a
 // notice accepted after that caller's earlier read.
 for(let offset=0;offset<unique.length;offset+=100){const chunk=unique.slice(offset,offset+100),values=chunk.flatMap(target=>[target.id,target.version]),sql=`WITH requested(inspection_id,target_version) AS (VALUES ${chunk.map(()=>'(?,?)').join(',')}),
 latest_draft AS (SELECT r.inspection_id,r.target_version,COALESCE(MAX(a.version),0) last_draft_version FROM requested r LEFT JOIN fire_inspection_pilot_audit a ON a.department_id=? AND a.record_id=r.inspection_id AND a.version<r.target_version AND a.payload::jsonb->>'status'='Draft' GROUP BY r.inspection_id,r.target_version),
 candidates AS (SELECT r.inspection_id,r.target_version,m.value::jsonb->>'id' action_id,(m.value::jsonb->'source'->>'inspectionVersion')::integer source_version,m.value::jsonb->'source'->>'payloadHash' source_hash FROM latest_draft r JOIN system_meta m ON m.key LIKE ? AND m.value::jsonb->>'type'='Void' AND m.value::jsonb->'source'->>'inspectionId'=r.inspection_id AND (m.value::jsonb->'source'->>'inspectionVersion')::integer<=r.target_version AND (m.value::jsonb->'source'->>'inspectionVersion')::integer>r.last_draft_version),
 source_versions AS (SELECT DISTINCT inspection_id,source_version FROM candidates),
 fingerprints AS (SELECT i.id inspection_id,i.version,encode(sha256(convert_to(i.payload,'UTF8')),'hex') payload_hash,i.payload::jsonb->>'status' source_status FROM fire_inspection_pilot_records i JOIN source_versions v ON v.inspection_id=i.id AND v.source_version=i.version WHERE i.department_id=? UNION ALL SELECT a.record_id inspection_id,a.version,encode(sha256(convert_to(a.payload,'UTF8')),'hex') payload_hash,a.payload::jsonb->>'status' source_status FROM fire_inspection_pilot_audit a JOIN source_versions v ON v.inspection_id=a.record_id AND v.source_version=a.version WHERE a.department_id=?)
 SELECT c.*,f.payload_hash,f.source_status FROM candidates c LEFT JOIN fingerprints f ON f.inspection_id=c.inspection_id AND f.version=c.source_version ORDER BY c.source_version DESC,c.action_id`;
  const rows=await db.prepare(sql).bind(...values,department,'inspection-report-action:'+department+':%',department,department).all<VoidRow>();
  for(const row of rows.results){if(!row.action_id||!/^[a-f0-9]{64}$/.test(row.source_hash??'')||row.source_hash!==row.payload_hash||row.source_status!=='Completed')throw Error('A void notice could not be matched to its original issued snapshot. Restore or review that original history before sending this issuance.');const key=reportIssuanceKey(row.inspection_id,Number(row.target_version));if(!result.has(key))result.set(key,{actionId:row.action_id,inspectionVersion:Number(row.source_version),payloadHash:row.source_hash});}
 }
 return result;
}
export async function reportIssuanceVoided(db:InspectionDb,department:string,id:string,version:number,actions?:ReportAction[]){return(await reportIssuanceVoids(db,department,[{id,version}],actions)).get(reportIssuanceKey(id,version))??null;}
