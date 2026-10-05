import { ensureDatabase } from '../../../../db/bootstrap';
import { hasPermission } from '../../../server-permissions';
import { inspectionBoundary, inspectionJson, decodeInspection, inspectionColumns, type StoredInspection } from '../../../fire-inspections/server';
import { observationFields } from '../../../fire-inspections/field-workflow';

export async function POST(request: Request) {
  const denied = inspectionBoundary(request, true); if (denied) return denied;
  try {
    const db=await ensureDatabase();
    if (!await hasPermission(request,db,'field_preplans.edit')) return inspectionJson({error:'Preplan editing permission is required.'},403);
    const raw=await request.text(); if(raw.length>12000)return inspectionJson({error:'The review is too large.'},413);
    const body=JSON.parse(raw), department=request.headers.get('x-department-id')!,actor=request.headers.get('oai-authenticated-user-email')!;
    const row=await db.prepare(`SELECT ${inspectionColumns} FROM fire_inspection_pilot_records WHERE department_id=? AND id=?`).bind(department,String(body.recordId||'')).first<StoredInspection>();
    if(!row)return inspectionJson({error:'This inspection is not available.'},404);
    const record=decodeInspection(row);
    if(record.version!==body.version)return inspectionJson({error:'The inspection changed. Reload and review its latest observations.'},409);
    if(record.archived||record.kind!=='inspection'||!record.data.propertyId||record.data.test)return inspectionJson({error:'Choose an active, linked department inspection. Test inspections cannot change operational preplans.'},400);
    const keys=Array.isArray(body.fields)?[...new Set(body.fields)] as (keyof typeof observationFields)[]:[];
    if(!keys.length||keys.some(key=>!Object.hasOwn(observationFields,key)||!record.data.preplanObservations[key]))return inspectionJson({error:'Choose recorded observations to apply.'},400);
    const fields={accessInfo:'access_info',knoxBox:'knox_box',fdc:'fdc',alarmSystem:'alarm_system',sprinklerSystem:'sprinkler_system'};
    const key=`inspection-preplan:${department}:${record.id}:${record.version}:${keys.slice().sort().join(',')}`;
    const prior=await db.prepare('SELECT value FROM system_meta WHERE key=?').bind(key).first<{value:string}>();
    if(prior)return inspectionJson({saved:true,receipt:JSON.parse(prior.value),replayed:true});
    const plan=await db.prepare('SELECT id,updated_at updatedAt,access_info accessInfo,knox_box knoxBox,fdc,alarm_system alarmSystem,sprinkler_system sprinklerSystem FROM field_preplans WHERE id=?').bind(record.data.propertyId).first<{id:string;updatedAt:string}&Record<keyof typeof observationFields,string>>();
    if(!plan)return inspectionJson({error:'The linked department preplan is unavailable.'},404);
    if(typeof body.expectedUpdatedAt!=='string'||!body.expectedUpdatedAt||body.expectedUpdatedAt!==plan.updatedAt)return inspectionJson({error:'The preplan changed. Refresh the property and review its current values before applying these observations.'},409);
    // Legacy writers timestamp to the second. Compare selected values too, so two edits
    // within that second cannot silently replace each other.
    if(!body.expectedValues||keys.some(k=>typeof body.expectedValues[k]!=='string'||body.expectedValues[k]!==String(plan[k]??'')))return inspectionJson({error:'A selected preplan field changed. Refresh the property and compare its current values.'},409);
    const receipt={recordId:record.id,version:record.version,propertyId:plan.id,fields:keys,actor,appliedAt:new Date().toISOString(),previous:Object.fromEntries(keys.map(k=>[k,plan[k]])),applied:Object.fromEntries(keys.map(k=>[k,record.data.preplanObservations[k]]))};
    await db.batch([
      // Guard both source inspection and destination, in the same transaction as the receipt.
      db.prepare('UPDATE fire_inspection_pilot_records SET version=version WHERE department_id=? AND id=? AND version=? AND archived=0').bind(department,record.id,record.version).expectChanges(1),
      db.prepare(`UPDATE field_preplans SET ${keys.map(k=>`${fields[k]}=?`).join(',')},updated_by=?,updated_at=? WHERE id=? AND updated_at=? AND ${keys.map(k=>`COALESCE(${fields[k]},'')=?`).join(' AND ')}`).bind(...keys.map(k=>record.data.preplanObservations[k]),actor,receipt.appliedAt,plan.id,body.expectedUpdatedAt,...keys.map(k=>body.expectedValues[k])).expectChanges(1),
      db.prepare('INSERT INTO system_meta(key,value,updated_at) VALUES(?,?,CURRENT_TIMESTAMP)').bind(key,JSON.stringify(receipt)).expectChanges(1),
    ]);
    return inspectionJson({saved:true,receipt});
  }catch(error){const message=error instanceof Error?error.message:'';
    if(/SAVE_CONFLICT|duplicate key/.test(message))return inspectionJson({error:'Another save arrived first. Refresh and review again; no partial update was applied.'},409);
    if(/Portal database|Portal transaction|fetch|bootstrap/.test(message))return inspectionJson({error:'The preplan update was not confirmed. Retry this same review.'},503);
    return inspectionJson({error:'Check the selected observations and retry.'},400);
  }
}
