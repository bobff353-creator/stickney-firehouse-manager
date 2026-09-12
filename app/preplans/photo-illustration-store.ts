import type { ensureDatabase } from '../../db/bootstrap';
import { validateIllustrations } from './photo-illustrations';

export function illustrationPayload(body:Record<string,unknown>){
  if(!Number.isSafeInteger(body.version)||Number(body.version)<0)throw new Error('A saved photo version is required. Reopen the photo.');
  if(typeof body.caption!=='string'||body.caption.length>500)throw new Error('Photo captions must be 500 characters or fewer.');
  return {version:Number(body.version),caption:body.caption.trim(),illustrations:validateIllustrations(body.illustrations)};
}

// One indexed compare-and-swap; parent freshness changes in the SAME transaction.
// Failed/concurrent/no-op writes cannot touch the parent or claim a new revision.
export const savePhotoIllustrationsSql = `WITH changed AS (
 UPDATE field_preplan_photos SET illustrations=?,illustration_version=illustration_version+1,caption=?
 WHERE id=? AND preplan_id=? AND illustration_version=? AND feature_id IS NULL AND side IN ('A','B','C','D')
 AND (illustrations IS DISTINCT FROM ? OR caption IS DISTINCT FROM ?)
 RETURNING id,preplan_id,illustration_version
), touched AS (
 UPDATE field_preplans SET updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE id IN (SELECT preplan_id FROM changed)
) SELECT id,illustration_version version FROM changed`;
export async function savePhotoIllustrations(db:Awaited<ReturnType<typeof ensureDatabase>>,photoId:string,preplanId:string,body:ReturnType<typeof illustrationPayload>,actor:string){
  const json=JSON.stringify(body.illustrations);
  return db.prepare(savePhotoIllustrationsSql).bind(json,body.caption,photoId,preplanId,body.version,json,body.caption,actor).first<{id:string;version:number}>();
}
