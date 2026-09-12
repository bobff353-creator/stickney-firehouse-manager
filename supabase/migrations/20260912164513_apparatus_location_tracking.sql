-- Only current apparatus positions, never employee locations or a route history.
CREATE TABLE firehouse.apparatus_trackers (
 department_id uuid NOT NULL REFERENCES public.departments(id),
 apparatus_id text NOT NULL REFERENCES firehouse.fleet_apparatus(id) ON DELETE CASCADE,
 device_id uuid NOT NULL DEFAULT gen_random_uuid(),
 token_hash text UNIQUE CHECK (token_hash ~ '^[a-f0-9]{64}$'),
 device_name text NOT NULL CHECK (length(device_name) BETWEEN 1 AND 60),
 sender_kind text NOT NULL CHECK (sender_kind IN ('browser','windows')),
 enabled boolean NOT NULL DEFAULT true,
 expires_at timestamptz NOT NULL DEFAULT (now()+interval '90 days'),
 latitude double precision, longitude double precision, accuracy double precision,
 fix_at timestamptz, received_at timestamptz, moving boolean NOT NULL DEFAULT false,
 sequence bigint NOT NULL DEFAULT 0,
 paired_by text NOT NULL, paired_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(department_id,apparatus_id),
 CHECK (department_id='14a76771-4c24-481b-8def-e6cce005c17b'::uuid),
 CHECK (latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180 AND accuracy>0 AND accuracy<=75)
);
ALTER TABLE firehouse.apparatus_trackers ENABLE ROW LEVEL SECURITY;
CREATE POLICY apparatus_trackers_server_only ON firehouse.apparatus_trackers FOR ALL TO authenticated USING(false) WITH CHECK(false);
REVOKE ALL ON firehouse.apparatus_trackers FROM PUBLIC,anon,authenticated,service_role;

-- A PIN-unlocked, permission-checked API grants one minute of receiving access.
-- The broadcast topic changes each minute: an already-open socket cannot keep
-- receiving after the lease expires, even if Realtime cached join authorization.
CREATE TABLE firehouse.apparatus_location_view_leases (
 department_id uuid NOT NULL REFERENCES public.departments(id),
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 topic text NOT NULL, expires_at timestamptz NOT NULL,
 PRIMARY KEY(user_id,department_id)
);
ALTER TABLE firehouse.apparatus_location_view_leases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON firehouse.apparatus_location_view_leases FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON firehouse.apparatus_location_view_leases TO authenticated;
GRANT USAGE ON SCHEMA firehouse TO authenticated;
CREATE POLICY own_location_lease ON firehouse.apparatus_location_view_leases FOR SELECT TO authenticated
 USING (user_id=(SELECT auth.uid()));
CREATE POLICY receive_apparatus_locations ON realtime.messages FOR SELECT TO authenticated
 USING (extension='broadcast' AND EXISTS (
  SELECT 1 FROM firehouse.apparatus_location_view_leases lease
  WHERE lease.user_id=(SELECT auth.uid()) AND lease.topic=realtime.topic() AND lease.expires_at>now()
 ));
-- No client INSERT policy: only the trusted ingest transaction can broadcast.

CREATE FUNCTION firehouse.apparatus_location_topic(p_department uuid, p_now timestamptz DEFAULT clock_timestamp())
RETURNS text LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT 'apparatus:'||p_department::text||':'||floor(extract(epoch FROM p_now)/60)::bigint::text
$$;

CREATE FUNCTION firehouse.publish_apparatus_location()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE payload jsonb; notification_id uuid:=gen_random_uuid(); channel_topic text;
BEGIN
 SELECT jsonb_build_object('apparatusId',f.id,'unit',f.unit_number,'name',f.name,'fleetStatus',f.status,
  'deviceId',NEW.device_id,'deviceName',NEW.device_name,'senderKind',NEW.sender_kind,
  'enabled',NEW.enabled AND NEW.expires_at>clock_timestamp(),'latitude',NEW.latitude,'longitude',NEW.longitude,
  'accuracy',NEW.accuracy,'fixAt',NEW.fix_at,'receivedAt',NEW.received_at,'moving',NEW.moving,'sequence',NEW.sequence)
 INTO payload FROM firehouse.fleet_apparatus f WHERE f.id=NEW.apparatus_id;
 channel_topic:=firehouse.apparatus_location_topic(NEW.department_id);
 payload:=payload||jsonb_build_object('id',notification_id);
 PERFORM realtime.send(payload,'location',channel_topic,true);
 -- The installed realtime.send catches insert errors and only warns. Verify
 -- its receipt before committing the position. Equality on inserted_at plus
 -- topic uses the provider's existing partial index and prunes old partitions.
 IF NOT EXISTS(SELECT 1 FROM realtime.messages WHERE inserted_at=transaction_timestamp()::timestamp
  AND topic=channel_topic AND extension='broadcast' AND private IS TRUE AND messages.payload->>'id'=notification_id::text)
 THEN RAISE EXCEPTION 'Location notification was not queued'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER broadcast_apparatus_location AFTER INSERT OR UPDATE ON firehouse.apparatus_trackers
 FOR EACH ROW EXECUTE FUNCTION firehouse.publish_apparatus_location();

-- The existing portal RPC wraps read results in a SELECT subquery. Put writes
-- that return data inside invoker functions, not INSERT ... RETURNING subqueries.
CREATE FUNCTION firehouse.pair_apparatus_tracker(p_department uuid,p_apparatus text,p_hash text,p_device_base64 text)
RETURNS TABLE("deviceId" uuid,"expiresAt" timestamptz)
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE device jsonb;
BEGIN
 device:=convert_from(decode(p_device_base64,'base64'),'UTF8')::jsonb;
 RETURN QUERY INSERT INTO firehouse.apparatus_trackers(department_id,apparatus_id,token_hash,device_name,sender_kind,paired_by)
 VALUES(p_department,p_apparatus,p_hash,device->>'name',device->>'kind',device->>'actor')
 ON CONFLICT(department_id,apparatus_id) DO UPDATE SET device_id=gen_random_uuid(),token_hash=excluded.token_hash,
 device_name=excluded.device_name,sender_kind=excluded.sender_kind,enabled=true,expires_at=clock_timestamp()+interval '90 days',
 paired_by=excluded.paired_by,paired_at=clock_timestamp(),sequence=apparatus_trackers.sequence+1
 RETURNING apparatus_trackers.device_id,apparatus_trackers.expires_at;
END $$;

CREATE FUNCTION firehouse.issue_apparatus_location_lease(p_department uuid,p_user uuid)
RETURNS TABLE(topic text,"expiresAt" timestamptz,"serverTime" timestamptz)
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE checked_at timestamptz:=clock_timestamp();
BEGIN
 RETURN QUERY INSERT INTO firehouse.apparatus_location_view_leases(department_id,user_id,topic,expires_at)
 VALUES(p_department,p_user,firehouse.apparatus_location_topic(p_department,checked_at),date_trunc('minute',checked_at)+interval '1 minute')
 ON CONFLICT(user_id,department_id) DO UPDATE SET topic=excluded.topic,expires_at=excluded.expires_at
 RETURNING apparatus_location_view_leases.topic,apparatus_location_view_leases.expires_at,checked_at;
END $$;

CREATE FUNCTION firehouse.ingest_apparatus_location(p_hash text,p_fix_base64 text,p_now timestamptz DEFAULT clock_timestamp())
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE tracker firehouse.apparatus_trackers; fix jsonb; lat double precision; lng double precision;
 accuracy_m double precision; measured timestamptz; moved boolean;
BEGIN
 SELECT * INTO tracker FROM firehouse.apparatus_trackers WHERE token_hash=p_hash FOR UPDATE;
 IF NOT FOUND OR NOT tracker.enabled OR tracker.expires_at<=p_now THEN RETURN jsonb_build_object('accepted',false,'reason','device_revoked'); END IF;
 IF NOT EXISTS (SELECT 1 FROM firehouse.fleet_apparatus WHERE id=tracker.apparatus_id AND (retired_at IS NULL OR retired_at=''))
 THEN RETURN jsonb_build_object('accepted',false,'reason','device_revoked'); END IF;
 IF tracker.received_at>p_now-interval '4 seconds' THEN RETURN jsonb_build_object('accepted',false,'reason','rate_limited','retryAfterMs',5000); END IF;
 IF length(p_fix_base64)>4096 THEN RETURN jsonb_build_object('accepted',false,'reason','invalid_fix'); END IF;
 BEGIN
  fix:=convert_from(decode(p_fix_base64,'base64'),'UTF8')::jsonb;
  IF jsonb_typeof(fix->'latitude')<>'number' OR jsonb_typeof(fix->'longitude')<>'number' OR jsonb_typeof(fix->'accuracy')<>'number'
   OR jsonb_typeof(fix->'measuredAt')<>'string' OR jsonb_typeof(fix->'moving')<>'boolean'
  THEN RETURN jsonb_build_object('accepted',false,'reason','invalid_fix'); END IF;
  lat:=(fix->>'latitude')::double precision; lng:=(fix->>'longitude')::double precision;
  accuracy_m:=(fix->>'accuracy')::double precision; measured:=(fix->>'measuredAt')::timestamptz; moved:=(fix->>'moving')::boolean;
 EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('accepted',false,'reason','invalid_fix'); END;
 IF lat IS NULL OR lng IS NULL OR accuracy_m IS NULL OR measured IS NULL OR moved IS NULL
 OR NOT (lat BETWEEN -90 AND 90 AND lng BETWEEN -180 AND 180 AND accuracy_m>0 AND accuracy_m<=75)
 OR measured<p_now-interval '30 seconds' OR measured>p_now+interval '5 seconds'
 THEN RETURN jsonb_build_object('accepted',false,'reason','invalid_fix'); END IF;
 IF tracker.fix_at IS NOT NULL AND measured<=tracker.fix_at THEN RETURN jsonb_build_object('accepted',false,'reason','old_fix'); END IF;
 UPDATE firehouse.apparatus_trackers SET latitude=lat,longitude=lng,accuracy=accuracy_m,fix_at=measured,
  received_at=p_now,moving=moved,sequence=sequence+1
 WHERE department_id=tracker.department_id AND apparatus_id=tracker.apparatus_id;
 RETURN jsonb_build_object('accepted',true,'apparatusId',tracker.apparatus_id,'deviceId',tracker.device_id,'sequence',tracker.sequence+1);
END $$;
REVOKE ALL ON FUNCTION firehouse.apparatus_location_topic(uuid,timestamptz) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION firehouse.publish_apparatus_location() FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION firehouse.pair_apparatus_tracker(uuid,text,text,text) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION firehouse.issue_apparatus_location_lease(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION firehouse.ingest_apparatus_location(text,text,timestamptz) FROM PUBLIC,anon,authenticated,service_role;
