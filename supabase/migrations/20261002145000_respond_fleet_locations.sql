-- Fleet is authoritative; retain old tracker IDs for units already paired.
CREATE OR REPLACE FUNCTION firehouse.apparatus_location_fleet(p_department uuid)
RETURNS TABLE(id text,unit_number text,name text,status text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT COALESCE(legacy.id,a.id::text),a.unit_name,
        COALESCE(NULLIF(a.unit_type,''),a.unit_name),a.status
 FROM public.department_apparatus a
 LEFT JOIN LATERAL (
   SELECT f.id FROM firehouse.fleet_apparatus f
   WHERE f.unit_number=a.unit_name
   ORDER BY CASE WHEN EXISTS(SELECT 1 FROM firehouse.apparatus_trackers t
     WHERE t.apparatus_id=f.id AND t.department_id=p_department) THEN 0 ELSE 1 END,f.id
   LIMIT 1
 ) legacy ON true
 WHERE a.department_id=p_department AND a.status IS DISTINCT FROM 'retired'
$$;
REVOKE ALL ON FUNCTION firehouse.apparatus_location_fleet(uuid) FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION firehouse.pair_apparatus_tracker(p_department uuid,p_apparatus text,p_hash text,p_device_base64 text)
RETURNS TABLE("deviceId" uuid,"expiresAt" timestamptz)
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE device jsonb; rig record;
BEGIN
 SELECT * INTO rig FROM firehouse.apparatus_location_fleet(p_department) WHERE id=p_apparatus;
 IF NOT FOUND THEN RAISE EXCEPTION 'Select a department fleet apparatus'; END IF;
 device:=convert_from(decode(p_device_base64,'base64'),'UTF8')::jsonb;
 -- Add a tracker-compatible reference only when paired. Existing IDs and fixes stay intact.
 INSERT INTO firehouse.fleet_apparatus(id,unit_number,name,status,created_by,updated_by)
 VALUES(rig.id,rig.unit_number,rig.name,rig.status,device->>'actor',device->>'actor')
 ON CONFLICT(id) DO NOTHING;
 RETURN QUERY INSERT INTO firehouse.apparatus_trackers(department_id,apparatus_id,token_hash,device_name,sender_kind,paired_by)
 VALUES(p_department,p_apparatus,p_hash,device->>'name',device->>'kind',device->>'actor')
 ON CONFLICT(department_id,apparatus_id) DO UPDATE SET device_id=gen_random_uuid(),token_hash=excluded.token_hash,
 device_name=excluded.device_name,sender_kind=excluded.sender_kind,enabled=true,expires_at=clock_timestamp()+interval '90 days',
 paired_by=excluded.paired_by,paired_at=clock_timestamp(),sequence=apparatus_trackers.sequence+1
 RETURNING apparatus_trackers.device_id,apparatus_trackers.expires_at;
END $$;
