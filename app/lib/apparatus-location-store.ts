import 'server-only';
import { createPostgresD1Adapter } from '../../db/postgres-adapter';
import { getSupabaseSystemClient } from '../supabase-system';
import { portalServerHeaders } from '../portal-server-headers';
import type { ApparatusLocation } from '../apparatus-location-domain';
export function locationDatabase() {
 return createPostgresD1Adapter(getSupabaseSystemClient,'firehouse_server_sql',portalServerHeaders()['x-firehouse-server-key']);
}
export const locationColumns=`f.id "apparatusId",f.unit_number unit,f.name,f.status "fleetStatus",t.device_id "deviceId",t.device_name "deviceName",t.sender_kind "senderKind",COALESCE(t.enabled AND t.expires_at>clock_timestamp(),false) enabled,t.latitude,t.longitude,t.accuracy,t.fix_at "fixAt",t.received_at "receivedAt",COALESCE(t.moving,false) moving,COALESCE(t.sequence,0) sequence`;
export async function readLocationSnapshot(department: string,user: string) {
 const db=locationDatabase();
 const lease=await db.prepare('SELECT * FROM issue_apparatus_location_lease(?::uuid,?::uuid)').bind(department,user).first<{topic:string;expiresAt:string;serverTime:string}>();
 const {results:units}=await db.prepare(`SELECT ${locationColumns} FROM fleet_apparatus f LEFT JOIN apparatus_trackers t ON t.apparatus_id=f.id AND t.department_id=?::uuid WHERE f.retired_at IS NULL OR f.retired_at='' ORDER BY f.unit_number LIMIT 100`).bind(department).all<ApparatusLocation>();
 if(!lease) throw Error('Location access unavailable');
 return {...lease,units};
}
