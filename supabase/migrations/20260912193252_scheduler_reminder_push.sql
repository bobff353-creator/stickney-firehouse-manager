-- Additive only. Existing records and legacy email/text preferences are retained.
-- No push backfill: administrators explicitly enable each rule after release.
SET LOCAL lock_timeout = '3s';
ALTER TABLE firehouse.station_reminder_rules
 ADD COLUMN push_enabled integer NOT NULL DEFAULT 0 CHECK(push_enabled IN (0,1)),
 ADD COLUMN push_enabled_at timestamptz;
ALTER TABLE firehouse.station_shift_slots
 ADD COLUMN request_deadline text NOT NULL DEFAULT '',
 ADD COLUMN reminder_changed_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE firehouse.station_shift_claims ADD COLUMN reminder_changed_at timestamptz NOT NULL DEFAULT now();

CREATE FUNCTION firehouse.scheduler_reminder_changed() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF TG_TABLE_NAME='station_reminder_rules' THEN
  IF NEW.push_enabled=1 AND NEW.enabled=1 AND
    (OLD.push_enabled<>1 OR OLD.enabled<>1 OR NEW.offsets IS DISTINCT FROM OLD.offsets) THEN NEW.push_enabled_at=now(); END IF;
 ELSIF TG_OP='INSERT' OR (to_jsonb(NEW)-'reminder_changed_at'-'updated_at'-'sort_order'-'staffing_reason') IS DISTINCT FROM (to_jsonb(OLD)-'reminder_changed_at'-'updated_at'-'sort_order'-'staffing_reason') THEN
  NEW.reminder_changed_at=now();
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER scheduler_rule_changed BEFORE UPDATE ON firehouse.station_reminder_rules FOR EACH ROW EXECUTE FUNCTION firehouse.scheduler_reminder_changed();
CREATE TRIGGER scheduler_slot_changed BEFORE INSERT OR UPDATE ON firehouse.station_shift_slots FOR EACH ROW EXECUTE FUNCTION firehouse.scheduler_reminder_changed();
CREATE TRIGGER scheduler_claim_changed BEFORE INSERT OR UPDATE ON firehouse.station_shift_claims FOR EACH ROW EXECUTE FUNCTION firehouse.scheduler_reminder_changed();

-- Serialize a new request with concurrent deadline/assignment changes. The
-- friendly API precheck is not sufficient once another administrator saves.
CREATE FUNCTION firehouse.scheduler_claim_deadline_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE slot record;
BEGIN
 IF NEW.status IS DISTINCT FROM 'pending' THEN RETURN NEW; END IF;
 SELECT s.status,s.request_deadline,en.entry_date,coalesce(nullif(s.start_time,''),t.start_time) start_time,t.active
 INTO slot FROM firehouse.station_shift_slots s JOIN firehouse.station_schedule_entries en ON en.id=s.entry_id
 JOIN firehouse.station_shift_types t ON t.id=en.shift_type_id WHERE s.id=NEW.slot_id FOR UPDATE OF s,en,t;
 IF NOT FOUND OR slot.status<>'open' OR slot.active<>1 OR
   ((slot.entry_date||' '||slot.start_time)::timestamp AT TIME ZONE 'America/Chicago')<=clock_timestamp() OR
   (slot.request_deadline<>'' AND (slot.request_deadline::timestamp AT TIME ZONE 'America/Chicago')<=clock_timestamp())
 THEN RAISE EXCEPTION 'SHIFT_REQUEST_CLOSED'; END IF;
 IF EXISTS(SELECT 1 FROM firehouse.station_shift_claims WHERE slot_id=NEW.slot_id AND employee_id=NEW.employee_id AND status='pending')
 THEN RAISE EXCEPTION 'SHIFT_REQUEST_DUPLICATE'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER scheduler_claim_deadline_guard BEFORE INSERT ON firehouse.station_shift_claims FOR EACH ROW EXECUTE FUNCTION firehouse.scheduler_claim_deadline_guard();
REVOKE ALL ON FUNCTION firehouse.scheduler_claim_deadline_guard() FROM PUBLIC,anon,authenticated,service_role;

CREATE TABLE firehouse.scheduler_push_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 department_id uuid NOT NULL DEFAULT '14a76771-4c24-481b-8def-e6cce005c17b' CHECK(department_id='14a76771-4c24-481b-8def-e6cce005c17b'),
 rule_id text NOT NULL, source_id text NOT NULL, source_kind text NOT NULL,
 version text NOT NULL, timing text NOT NULL, due_at timestamptz NOT NULL, expires_at timestamptz NOT NULL,
 payload jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(rule_id,source_kind,source_id,version,timing)
);
CREATE TABLE firehouse.scheduler_push_deliveries (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), event_id uuid NOT NULL REFERENCES firehouse.scheduler_push_events(id),
 subscription_id text NOT NULL, recipient_id text NOT NULL, credential_fingerprint text NOT NULL,
 state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','sending','retry','accepted','cancelled','expired','failed')),
 attempts integer NOT NULL DEFAULT 0, next_attempt_at timestamptz NOT NULL DEFAULT now(),
 lease_token uuid, accepted_at timestamptz, last_status_code integer,
 UNIQUE(event_id,subscription_id)
);
CREATE INDEX scheduler_push_pending_idx ON firehouse.scheduler_push_deliveries(next_attempt_at,id) WHERE state IN ('pending','sending','retry');
CREATE INDEX scheduler_reminder_entry_date_idx ON firehouse.station_schedule_entries(entry_date,id);
CREATE INDEX scheduler_reminder_claim_slot_idx ON firehouse.station_shift_claims(slot_id,status);
CREATE INDEX scheduler_reminder_deadline_idx ON firehouse.station_shift_slots(request_deadline) WHERE request_deadline<>'';
ALTER TABLE firehouse.scheduler_push_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE firehouse.scheduler_push_deliveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON firehouse.scheduler_push_events,firehouse.scheduler_push_deliveries FROM PUBLIC,anon,authenticated,service_role;

-- Background authorization uses authoritative membership, never JWT user_metadata.
CREATE FUNCTION firehouse.scheduler_push_permission(recipient text, permission text) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE actor_email text; employee record; matches integer; effect_value text; saved boolean;
BEGIN
 IF permission NOT IN ('scheduling.view','scheduling.manage') OR recipient IS NULL OR recipient !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN RETURN false; END IF;
 SELECT lower(btrim(u.email)) INTO actor_email FROM auth.users u WHERE u.id=recipient::uuid AND u.deleted_at IS NULL AND (u.banned_until IS NULL OR u.banned_until<=now());
 IF actor_email IS NULL THEN RETURN false; END IF;
 IF actor_email='bobff353@gmail.com' AND EXISTS(SELECT 1 FROM public.platform_owners p WHERE lower(btrim(p.email))=actor_email) THEN RETURN true; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.department_memberships m WHERE m.department_id='14a76771-4c24-481b-8def-e6cce005c17b' AND m.user_id=recipient::uuid AND m.status='active') THEN RETURN false; END IF;
 SELECT count(*) INTO matches FROM firehouse.employees e JOIN firehouse.employee_profiles ep ON ep.employee_id=e.id WHERE e.active=1 AND lower(btrim(ep.email))=actor_email;
 IF matches<>1 THEN RETURN false; END IF;
 SELECT e.id,p.label rank,coalesce(ep.is_admin,0) is_admin,ep.end_date INTO employee
 FROM firehouse.employees e JOIN firehouse.employee_profiles ep ON ep.employee_id=e.id JOIN firehouse.pay_scales p ON p.id=e.pay_scale_id WHERE e.active=1 AND lower(btrim(ep.email))=actor_email;
 IF NOT FOUND OR (coalesce(employee.end_date,'')<>'' AND employee.end_date<to_char(now() AT TIME ZONE 'America/Chicago','YYYY-MM-DD')) THEN RETURN false; END IF;
 SELECT effect INTO effect_value FROM firehouse.employee_permission_overrides WHERE employee_id=employee.id AND permission_key=permission;
 IF effect_value='deny' THEN RETURN false; END IF;
 IF effect_value='allow' THEN RETURN true; END IF;
 IF employee.is_admin=1 THEN RETURN true; END IF;
 SELECT allowed=1 INTO saved FROM firehouse.rank_permissions WHERE rank=employee.rank AND permission_key=permission;
 IF FOUND THEN RETURN saved; END IF;
 RETURN permission='scheduling.view' OR lower(employee.rank) ~ '(chief|captain|lieutenant)';
END $$;

-- Local timestamps are interpreted explicitly in Chicago, including DST.
CREATE VIEW firehouse.scheduler_reminder_slots WITH (security_invoker=true) AS
 SELECT s.*,en.entry_date,t.active shift_active,
 (en.entry_date||' '||coalesce(nullif(s.start_time,''),t.start_time))::timestamp AS local_start,
 (en.entry_date||' '||coalesce(nullif(s.end_time,''),t.end_time))::timestamp
  + CASE WHEN coalesce(nullif(s.end_time,''),t.end_time)<=coalesce(nullif(s.start_time,''),t.start_time) THEN interval '1 day' ELSE interval '0' END AS local_end
 FROM firehouse.station_shift_slots s JOIN firehouse.station_schedule_entries en ON en.id=s.entry_id JOIN firehouse.station_shift_types t ON t.id=en.shift_type_id;
REVOKE ALL ON firehouse.scheduler_reminder_slots FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION firehouse.scheduler_reminder_due(anchor timestamp,changed_at timestamptz,timing text) RETURNS timestamptz
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT CASE WHEN timing='immediate' THEN changed_at
  WHEN timing ~ '^[1-9][0-9]? days? before$' AND split_part(timing,' ',1)::integer<=60 THEN (anchor-make_interval(days=>split_part(timing,' ',1)::integer)) AT TIME ZONE 'America/Chicago'
  WHEN timing ~ '^[1-9][0-9]{0,2} hours? before$' AND split_part(timing,' ',1)::integer<=168 THEN (anchor AT TIME ZONE 'America/Chicago')-make_interval(hours=>split_part(timing,' ',1)::integer)
 END;
$$;

CREATE FUNCTION firehouse.scheduler_reminder_candidates(kind_filter text DEFAULT NULL,id_filter text DEFAULT NULL) RETURNS TABLE(
 rule_id text,source_id text,source_kind text,version text,timing text,due_at timestamptz,expires_at timestamptz,payload jsonb
) LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 WITH sources AS (
  SELECT r.id rule_id,r.type,r.offsets,r.push_enabled_at,s.id source_id,'slot'::text source_kind,
   md5(jsonb_build_array(s.reminder_changed_at,s.local_start,s.local_end,s.request_deadline)::text) version,
   s.reminder_changed_at changed_at,
   CASE WHEN r.type='request_deadline' THEN nullif(s.request_deadline,'')::timestamp ELSE s.local_start END anchor,
   least(s.local_start AT TIME ZONE 'America/Chicago',coalesce(nullif(s.request_deadline,'')::timestamp AT TIME ZONE 'America/Chicago',s.local_start AT TIME ZONE 'America/Chicago')) cutoff,
   s.entry_date,s.role,'Open position'::text message
  FROM firehouse.station_reminder_rules r JOIN firehouse.scheduler_reminder_slots s ON s.status='open' AND s.shift_active=1
  WHERE r.enabled=1 AND r.push_enabled=1 AND r.type IN ('open_shift_blast','request_deadline')
   AND (kind_filter IS NULL OR kind_filter='slot') AND (id_filter IS NULL OR s.id=id_filter)
   AND s.entry_date>=to_char(now() AT TIME ZONE 'America/Chicago','YYYY-MM-DD')
   AND (s.entry_date<=to_char((now() AT TIME ZONE 'America/Chicago')+interval '62 days','YYYY-MM-DD') OR s.reminder_changed_at>now()-interval '24 hours'
    OR (s.request_deadline<>'' AND s.request_deadline<=to_char((now() AT TIME ZONE 'America/Chicago')+interval '62 days','YYYY-MM-DD"T"HH24:MI')))
   AND (r.type<>'request_deadline' OR s.request_deadline<>'')
  UNION ALL
  SELECT r.id,r.type,r.offsets,r.push_enabled_at,c.id,'claim',
   md5(jsonb_build_array(c.reminder_changed_at,c.status,s.local_start,s.local_end)::text),c.reminder_changed_at,s.local_start,
   s.local_start AT TIME ZONE 'America/Chicago',s.entry_date,s.role,'Shift request: '||c.status
  FROM firehouse.station_reminder_rules r JOIN firehouse.station_shift_claims c ON true JOIN firehouse.scheduler_reminder_slots s ON s.id=c.slot_id AND s.shift_active=1
  WHERE r.enabled=1 AND r.push_enabled=1 AND r.type='shift_request'
   AND (kind_filter IS NULL OR kind_filter='claim') AND (id_filter IS NULL OR c.id=id_filter)
   AND s.entry_date>=to_char(now() AT TIME ZONE 'America/Chicago','YYYY-MM-DD')
   AND (s.entry_date<=to_char((now() AT TIME ZONE 'America/Chicago')+interval '62 days','YYYY-MM-DD') OR c.reminder_changed_at>now()-interval '24 hours')
 ), timings AS (
  SELECT x.*,o.timing,firehouse.scheduler_reminder_due(x.anchor,x.changed_at,o.timing) due_at
  FROM sources x CROSS JOIN LATERAL jsonb_array_elements_text(x.offsets::jsonb) o(timing)
  WHERE x.source_kind<>'claim' OR o.timing='immediate' OR EXISTS(SELECT 1 FROM firehouse.station_shift_claims c WHERE c.id=x.source_id AND c.status='pending')
 ) SELECT rule_id,source_id,source_kind,version,timing,due_at,least(cutoff,due_at+interval '24 hours'),
 jsonb_build_object('title','Stickney schedule reminder','body',message||' · '||entry_date||' · '||role,'url','/?page=scheduling&display=portal','kind','scheduler')
 FROM timings WHERE due_at>=push_enabled_at AND due_at<=now() AND cutoff>now() AND due_at>now()-interval '24 hours';
$$;

CREATE FUNCTION firehouse.scheduler_push_recipient_allowed(event firehouse.scheduler_push_events,recipient text) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE member_id text; qualifications record; slot firehouse.scheduler_reminder_slots; claim record; can_manage boolean;
BEGIN
 IF event.department_id<>'14a76771-4c24-481b-8def-e6cce005c17b'::uuid THEN RETURN false; END IF;
 can_manage=firehouse.scheduler_push_permission(recipient,'scheduling.manage');
 IF NOT can_manage AND NOT firehouse.scheduler_push_permission(recipient,'scheduling.view') THEN RETURN false; END IF;
 IF NOT EXISTS(SELECT 1 FROM firehouse.scheduler_reminder_candidates(event.source_kind,event.source_id) c WHERE c.rule_id=event.rule_id AND c.version=event.version AND c.timing=event.timing) THEN RETURN false; END IF;
 SELECT ep.employee_id INTO member_id FROM firehouse.employee_profiles ep JOIN firehouse.employees e ON e.id=ep.employee_id AND e.active=1 JOIN auth.users u ON lower(btrim(u.email))=lower(btrim(ep.email)) WHERE u.id=recipient::uuid;
 IF event.source_kind='claim' THEN
  SELECT c.employee_id INTO claim FROM firehouse.station_shift_claims c WHERE c.id=event.source_id;
  RETURN can_manage OR claim.employee_id=member_id;
 END IF;
 SELECT * INTO slot FROM firehouse.scheduler_reminder_slots s WHERE s.id=event.source_id AND s.status='open';
 IF NOT FOUND OR member_id IS NULL THEN RETURN false; END IF;
 SELECT p.label rank,coalesce(ep.single_role,0) single_role,coalesce(ep.acting_officer_eligible,0) acting_officer_eligible,coalesce(ep.driver_status,'') driver_status INTO qualifications FROM firehouse.employees e JOIN firehouse.employee_profiles ep ON ep.employee_id=e.id JOIN firehouse.pay_scales p ON p.id=e.pay_scale_id WHERE e.id=member_id AND coalesce(btrim(ep.end_date),'')='';
 IF NOT FOUND OR slot.role NOT IN ('Extra member','Firefighter','Training/Orientation','Officer/AO','Engine Driver','Ambulance Driver','FF/Attendant') THEN RETURN false; END IF;
 IF slot.role NOT IN ('Extra member','Firefighter','Training/Orientation') THEN
  IF qualifications.single_role=1 OR lower(qualifications.rank) ~ '\msingle[-\s]*role\M' THEN RETURN false; END IF;
  IF NOT (lower(qualifications.rank) ~ '\m(chief|captain|lieutenant)\M' OR qualifications.acting_officer_eligible=1) THEN
   IF slot.role='Officer/AO' THEN RETURN false; END IF;
   IF slot.role='Engine Driver' AND lower(btrim(qualifications.driver_status))<>'cleared' THEN RETURN false; END IF;
   IF slot.role='Ambulance Driver' AND lower(btrim(qualifications.driver_status)) NOT IN ('cleared','ambulance only') THEN RETURN false; END IF;
  END IF;
 END IF;
 IF EXISTS(SELECT 1 FROM firehouse.station_shift_claims c WHERE c.slot_id=slot.id AND c.employee_id=member_id AND c.status='pending') THEN RETURN false; END IF;
 IF EXISTS(SELECT 1 FROM firehouse.scheduler_reminder_slots occupied WHERE occupied.employee_id=member_id AND occupied.status='filled'
  AND occupied.entry_date BETWEEN to_char(slot.local_start-interval '1 day','YYYY-MM-DD') AND to_char(slot.local_start+interval '1 day','YYYY-MM-DD')
  AND occupied.local_start<slot.local_end AND slot.local_start<occupied.local_end) THEN RETURN false; END IF;
 IF EXISTS(SELECT 1 FROM firehouse.station_availability a WHERE a.employee_id=member_id AND a.status='unavailable' AND a.availability_date=slot.entry_date AND
  (a.all_day=1 OR ((a.availability_date||' '||a.start_time)::timestamp<slot.local_end AND
   (a.availability_date||' '||a.end_time)::timestamp+CASE WHEN a.end_time<=a.start_time THEN interval '1 day' ELSE interval '0' END>slot.local_start))) THEN RETURN false; END IF;
 RETURN true;
END $$;

CREATE FUNCTION firehouse.enqueue_scheduler_push() RETURNS integer
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE event firehouse.scheduler_push_events; added integer:=0;
BEGIN
 -- Serialize planners, not call processing. Deduplication is also enforced by UNIQUE.
 IF NOT pg_try_advisory_xact_lock(12120912,1) THEN RETURN 0; END IF;
 FOR event IN
  INSERT INTO firehouse.scheduler_push_events(rule_id,source_id,source_kind,version,timing,due_at,expires_at,payload)
  SELECT * FROM firehouse.scheduler_reminder_candidates() ON CONFLICT DO NOTHING RETURNING *
 LOOP
  INSERT INTO firehouse.scheduler_push_deliveries(event_id,subscription_id,recipient_id,credential_fingerprint)
  SELECT event.id,s.id,s.user_id,md5(jsonb_build_array(s.endpoint,s.p256dh,s.auth)::text)
  FROM firehouse.push_subscriptions s WHERE s.department_id=event.department_id::text AND s.active=1
   AND firehouse.scheduler_push_recipient_allowed(event,s.user_id) ON CONFLICT DO NOTHING;
  added=added+1;
 END LOOP;
 RETURN added;
END $$;

CREATE FUNCTION firehouse.claim_scheduler_push() RETURNS SETOF jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 RETURN QUERY WITH candidates AS (
  SELECT d.id FROM firehouse.scheduler_push_deliveries d WHERE d.state IN ('pending','sending','retry') AND d.next_attempt_at<=now()
  ORDER BY d.next_attempt_at,d.id LIMIT 50 FOR UPDATE SKIP LOCKED
 ), claimed AS (
  UPDATE firehouse.scheduler_push_deliveries d SET state=CASE WHEN e.expires_at<=now() THEN 'expired' WHEN d.attempts>=6 THEN 'failed'
   WHEN EXISTS(SELECT 1 FROM firehouse.push_subscriptions s WHERE s.id=d.subscription_id AND s.active=1 AND s.user_id=d.recipient_id AND s.department_id=e.department_id::text
    AND md5(jsonb_build_array(s.endpoint,s.p256dh,s.auth)::text)=d.credential_fingerprint AND firehouse.scheduler_push_recipient_allowed(e,s.user_id)) THEN 'sending' ELSE 'cancelled' END,
   attempts=d.attempts+1,lease_token=gen_random_uuid(),next_attempt_at=now()+interval '90 seconds'
  FROM candidates c,firehouse.scheduler_push_events e WHERE d.id=c.id AND e.id=d.event_id RETURNING d.*
 ) SELECT jsonb_build_object('id',d.id,'lease',d.lease_token,'eventId',e.id,'payload',e.payload||jsonb_build_object('eventId',e.id,'tag','scheduler-'||e.id),
  'endpoint',s.endpoint,'p256dh',s.p256dh,'auth',s.auth,'ttl',greatest(1,floor(extract(epoch FROM e.expires_at-now()))::integer))
 FROM claimed d JOIN firehouse.scheduler_push_events e ON e.id=d.event_id JOIN firehouse.push_subscriptions s ON s.id=d.subscription_id WHERE d.state='sending';
END $$;
CREATE FUNCTION firehouse.finish_scheduler_push_batch(encoded text) RETURNS integer
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE changed integer;
BEGIN
 WITH outcomes AS (SELECT * FROM jsonb_to_recordset(convert_from(decode(encoded,'base64'),'UTF8')::jsonb) AS x(id uuid,lease uuid,status integer)),
 finished AS (
  UPDATE firehouse.scheduler_push_deliveries d SET state=CASE WHEN o.status BETWEEN 200 AND 299 THEN 'accepted' WHEN d.attempts>=6 THEN 'failed'
   WHEN o.status=0 OR o.status=429 OR o.status>=500 THEN 'retry' ELSE 'failed' END,
   accepted_at=CASE WHEN o.status BETWEEN 200 AND 299 THEN now() ELSE NULL END,last_status_code=o.status,lease_token=NULL,next_attempt_at=now()+interval '5 minutes'
  FROM outcomes o WHERE d.id=o.id AND d.lease_token=o.lease AND d.state='sending' RETURNING d.*
 ), per_subscription AS (
  SELECT subscription_id,recipient_id,credential_fingerprint,bool_or(last_status_code IN (404,410)) dead,bool_and(state='accepted') accepted,
   count(*) FILTER(WHERE state<>'accepted') failures,max(last_status_code) status FROM finished GROUP BY subscription_id,recipient_id,credential_fingerprint
 ) UPDATE firehouse.push_subscriptions s SET active=CASE WHEN p.dead THEN 0 ELSE s.active END,failure_count=CASE WHEN p.accepted THEN 0 ELSE s.failure_count+p.failures END,
  last_success_at=CASE WHEN p.accepted THEN now()::text ELSE s.last_success_at END,last_error=CASE WHEN p.accepted THEN '' ELSE 'Push provider status '||p.status::text END,updated_at=now()::text
 FROM per_subscription p WHERE s.id=p.subscription_id AND s.user_id=p.recipient_id AND md5(jsonb_build_array(s.endpoint,s.p256dh,s.auth)::text)=p.credential_fingerprint;
 GET DIAGNOSTICS changed=ROW_COUNT;
 RETURN changed;
END $$;
REVOKE ALL ON FUNCTION firehouse.scheduler_reminder_changed(),firehouse.scheduler_reminder_due(timestamp,timestamptz,text),firehouse.scheduler_push_permission(text,text),firehouse.scheduler_reminder_candidates(text,text),firehouse.scheduler_push_recipient_allowed(firehouse.scheduler_push_events,text),firehouse.enqueue_scheduler_push(),firehouse.claim_scheduler_push(),firehouse.finish_scheduler_push_batch(text) FROM PUBLIC,anon,authenticated,service_role;
