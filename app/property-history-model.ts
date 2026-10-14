export type HistoryCursor={at:string;key:string};
export type PropertyHistoryEntry={key:string;at:string;source:string;recordId:string;version:number;title:string;status:string;archived:number;actor:string};
export function parseHistoryCursor(value:string|null):HistoryCursor|null {
  if(!value)return null;
  try{const cursor=JSON.parse(Buffer.from(value,'base64url').toString('utf8')) as HistoryCursor;
    if(value.length>600||!cursor||typeof cursor.at!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/.test(cursor.at)||!Number.isFinite(Date.parse(cursor.at))||typeof cursor.key!=='string'||!cursor.key||cursor.key.length>160)throw Error();
    return {at:cursor.at,key:cursor.key};
  }catch{throw Error('The history page link is invalid. Refresh the property history.');}
}
export function historyCursor(entry:PropertyHistoryEntry){return Buffer.from(JSON.stringify({at:entry.at,key:entry.key})).toString('base64url');}
// Compare stored property IDs only. Addresses and business names never establish a link.
export const propertyHistorySql=`WITH history AS (
  SELECT 'inspection:'||a.id AS key,to_char(a.created_at::timestamptz AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS at,
    'Inspection' AS source,a.record_id AS recordId,a.version,
    COALESCE(a.payload::jsonb->>'title','Inspection') AS title,COALESCE(a.payload::jsonb->>'status','') AS status,a.archived,a.actor
  FROM fire_inspection_pilot_audit a
  WHERE a.department_id=? AND a.kind='inspection' AND a.payload::jsonb->>'propertyId'=? AND COALESCE(a.payload::jsonb->>'test','false')<>'true'
  UNION ALL
  SELECT 'preplan:'||r.id AS key,to_char(r.created_at::timestamptz AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS at,
    'Preplan revision' AS source,r.preplan_id AS recordId,r.revision_number AS version,
    COALESCE(NULLIF(r.summary,''),'Preplan revision saved') AS title,r.publication_status AS status,0 AS archived,r.actor
  FROM field_preplan_revisions r WHERE r.preplan_id=?
) SELECT * FROM history`;
