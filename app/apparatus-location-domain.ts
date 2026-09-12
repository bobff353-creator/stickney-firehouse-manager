export type LocationFix = { latitude: number; longitude: number; accuracy: number; measuredAt: string; moving: boolean };
export type ApparatusLocation = {
 apparatusId: string; unit: string; name: string; fleetStatus: string;
 deviceId: string | null; deviceName: string | null; senderKind: 'browser' | 'windows' | null; enabled: boolean;
 latitude: number | null; longitude: number | null; accuracy: number | null;
 fixAt: string | null; receivedAt: string | null; moving: boolean; sequence: number;
};
export type LocationSnapshot = { departmentId: string; userId: string; units: ApparatusLocation[]; topic: string; expiresAt: string; serverTime: string; canManage: boolean };
export const locationCadence = { responding: 5000, moving: 15000, parked: 120000, maxAccuracy: 75, maxFixAge: 30000 } as const;
export function validLocationFix(value: unknown, now=Date.now()): value is LocationFix {
 if(!value || typeof value!=='object') return false;
 const fix=value as Partial<LocationFix>;
 return typeof fix.latitude==='number' && Number.isFinite(fix.latitude) && Math.abs(fix.latitude)<=90
  && typeof fix.longitude==='number' && Number.isFinite(fix.longitude) && Math.abs(fix.longitude)<=180
  && typeof fix.accuracy==='number' && fix.accuracy>0 && fix.accuracy<=locationCadence.maxAccuracy
  && typeof fix.moving==='boolean' && typeof fix.measuredAt==='string' && Number.isFinite(Date.parse(fix.measuredAt))
  && Date.parse(fix.measuredAt)>=now-locationCadence.maxFixAge && Date.parse(fix.measuredAt)<=now+5000;
}
export function metresBetween(a: Pick<LocationFix,'latitude'|'longitude'>,b: Pick<LocationFix,'latitude'|'longitude'>) {
 const radians=Math.PI/180, dlat=(b.latitude-a.latitude)*radians, dlng=(b.longitude-a.longitude)*radians;
 const value=Math.sin(dlat/2)**2+Math.cos(a.latitude*radians)*Math.cos(b.latitude*radians)*Math.sin(dlng/2)**2;
 return 6371000*2*Math.atan2(Math.sqrt(value),Math.sqrt(Math.max(0,1-value)));
}
export function shouldSendLocation(fix: LocationFix,last: LocationFix|null,lastSent: number,responding: boolean,now=Date.now()) {
 if(!validLocationFix(fix,now)) return false;
 if(!last) return true;
 if(Date.parse(fix.measuredAt)<=Date.parse(last.measuredAt)) return false;
 const elapsed=now-lastSent;
 if(elapsed<locationCadence.responding) return false;
 if(fix.moving!==last.moving) return true;
 const moved=metresBetween(last,fix)>Math.max(20,Math.min(fix.accuracy,last.accuracy));
 return fix.moving || moved ? elapsed>=(responding?locationCadence.responding:locationCadence.moving) : elapsed>=locationCadence.parked;
}
export function locationAgeLabel(unit: ApparatusLocation,now=Date.now(),connected=true) {
 if(unit.latitude==null || unit.longitude==null || !unit.fixAt) return unit.deviceId ? 'Waiting for accurate location' : 'Not paired';
 const seconds=Math.max(0,Math.floor((now-Date.parse(unit.fixAt))/1000));
 const age=seconds<60?`${seconds}s ago`:seconds<3600?`${Math.floor(seconds/60)}m ago`:`${Math.floor(seconds/3600)}h ago`;
 const current=connected && unit.enabled && seconds<=(unit.moving?30:180);
 return `${current?'Updated':'Last known'} ${age}`;
}
export function mergeLocation(units: ApparatusLocation[],update: ApparatusLocation) {
 const previous=units.find(unit=>unit.apparatusId===update.apparatusId);
 // Bootstrap defines the authorized fleet. Do not accept arbitrary socket IDs.
 if(!previous || update.sequence<previous.sequence) return units;
 return units.map(unit=>unit.apparatusId===update.apparatusId?update:unit);
}
