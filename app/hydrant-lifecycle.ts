import type { ensureDatabase } from '../db/bootstrap';

type Database = Awaited<ReturnType<typeof ensureDatabase>>;
type HydrantState = { id: string; serviceStatus: string };

/** Archive preserves the hydrant and both sides of every historic flow test. */
export async function changeHydrantArchive(db: Database, id: string, actor: string, restore = false) {
  const current = await db.prepare('SELECT id,service_status serviceStatus FROM field_hydrants WHERE id=?').bind(id).first<HydrantState>();
  if (!current) throw Error('Hydrant not found.');
  const status = restore ? 'out_of_service' : 'archived';
  if (restore ? current.serviceStatus !== 'archived' : current.serviceStatus === 'archived') {
    return { id, archived: current.serviceStatus === 'archived', serviceStatus: current.serviceStatus, saved: true };
  }
  await db.batch([
    db.prepare('UPDATE field_hydrants SET service_status=?,updated_by=?,updated_at=? WHERE id=? AND service_status=?')
      .bind(status, actor, new Date().toISOString(), id, current.serviceStatus).expectChanges(1),
    db.prepare("INSERT INTO record_revisions(id,record_type,record_id,revision_number,action,summary,actor) SELECT ?,'hydrant',?,COALESCE(MAX(revision_number),0)+1,?,?,? FROM record_revisions WHERE record_type='hydrant' AND record_id=?")
      .bind(crypto.randomUUID(), id, restore ? 'restore' : 'archive', JSON.stringify({ from: current.serviceStatus, to: status, historyPreserved: true }), actor, id),
  ]);
  return { id, archived: !restore, serviceStatus: status, saved: true };
}

export const activeHydrant = (hydrant: { serviceStatus: string }) => hydrant.serviceStatus !== 'archived';

export type HydrantProfile = { id: string; hydrantNumber: string; address: string; latitude: number; longitude: number; serviceStatus: string; manufacturer: string; model: string; portCount: number; portSizes: string[]; notes: string };
type SavedProfile = Omit<HydrantProfile,'portSizes'> & { portSizes: string; updatedAt: string };
export async function saveHydrantProfile(db: Database, profile: HydrantProfile, actor: string, expectedUpdatedAt: string) {
  const current = await db.prepare('SELECT id,hydrant_number hydrantNumber,address,latitude,longitude,service_status serviceStatus,manufacturer,model,port_count portCount,port_sizes portSizes,notes,updated_at updatedAt FROM field_hydrants WHERE id=?').bind(profile.id).first<SavedProfile>();
  if (current?.serviceStatus === 'archived') throw Error('SAVE_CONFLICT: Restore this archived hydrant before editing it.');
  if (current) {
    const same=Object.entries(profile).every(([key,value])=>key==='portSizes'?JSON.stringify(JSON.parse(current.portSizes))===JSON.stringify(value):current[key as keyof SavedProfile]===value);
    if(same)return {id:profile.id,updatedAt:current.updatedAt,saved:true};
    if(!expectedUpdatedAt||current.updatedAt!==expectedUpdatedAt)throw Error('SAVE_CONFLICT: The hydrant changed. Reload its saved record before editing it.');
  }
  const updatedAt=new Date(Math.max(Date.now(),(Date.parse(current?.updatedAt||'')||0)+1)).toISOString();
  const values=[profile.hydrantNumber,profile.address,profile.latitude,profile.longitude,profile.serviceStatus,profile.manufacturer,profile.model,profile.portCount,JSON.stringify(profile.portSizes),profile.notes,actor,updatedAt] as const;
  const write=current
    ? db.prepare("UPDATE field_hydrants SET hydrant_number=?,address=?,latitude=?,longitude=?,service_status=?,manufacturer=?,model=?,port_count=?,port_sizes=?,notes=?,updated_by=?,updated_at=? WHERE id=? AND updated_at=? AND service_status<>'archived'").bind(...values,profile.id,expectedUpdatedAt).expectChanges(1)
    : db.prepare('INSERT INTO field_hydrants(hydrant_number,address,latitude,longitude,service_status,manufacturer,model,port_count,port_sizes,notes,updated_by,updated_at,id,created_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(...values,profile.id,actor).expectChanges(1);
  await db.batch([write,db.prepare("INSERT INTO record_revisions(id,record_type,record_id,revision_number,action,summary,actor) SELECT ?,'hydrant',?,COALESCE(MAX(revision_number),0)+1,'save',?,? FROM record_revisions WHERE record_type='hydrant' AND record_id=?").bind(crypto.randomUUID(),profile.id,JSON.stringify({before:current??null,after:profile}),actor,profile.id)]);
  return {id:profile.id,updatedAt,saved:true};
}
