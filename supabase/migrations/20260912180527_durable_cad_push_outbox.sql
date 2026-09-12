-- This firehouse schema is the verified single-department Stickney portal.
-- No backfill: installing this migration must never alert historical calls.
CREATE TABLE firehouse.cad_push_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 department_id uuid NOT NULL CHECK (department_id='14a76771-4c24-481b-8def-e6cce005c17b'),
 incident_id text NOT NULL,
 payload jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(department_id,incident_id)
);
CREATE TABLE firehouse.cad_push_deliveries (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 event_id uuid NOT NULL REFERENCES firehouse.cad_push_events(id),
 subscription_id text NOT NULL,
 recipient_id text NOT NULL,
 credential_fingerprint text NOT NULL,
 state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','sending','retry','accepted','cancelled','expired','failed')),
 attempts integer NOT NULL DEFAULT 0,
 next_attempt_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL DEFAULT now()+interval '5 minutes',
 lease_token uuid,
 accepted_at timestamptz,
 last_status_code integer,
 UNIQUE(event_id,subscription_id)
);
CREATE INDEX cad_push_pending_idx ON firehouse.cad_push_deliveries(next_attempt_at,id)
 WHERE state IN ('pending','sending','retry');
ALTER TABLE firehouse.cad_push_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE firehouse.cad_push_deliveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON firehouse.cad_push_events,firehouse.cad_push_deliveries FROM PUBLIC,anon,authenticated,service_role;

-- Background delivery has no browser PIN/JWT. Check authoritative identities,
-- active membership and the same field_preplans.view policy used by Respond.
CREATE FUNCTION firehouse.cad_push_recipient_allowed(department uuid, recipient text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE actor_email text; employee record; matches integer; effect_value text; saved boolean;
BEGIN
 IF department<>'14a76771-4c24-481b-8def-e6cce005c17b'::uuid OR department IS NULL THEN RETURN false; END IF;
 IF recipient IS NULL OR recipient !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN RETURN false; END IF;
 SELECT lower(btrim(u.email)) INTO actor_email FROM auth.users u
 WHERE u.id=recipient::uuid AND u.deleted_at IS NULL AND (u.banned_until IS NULL OR u.banned_until<=now());
 IF actor_email IS NULL THEN RETURN false; END IF;
 -- Preserve the existing portal owner exception; never trust user_metadata.
 IF actor_email='bobff353@gmail.com' AND EXISTS(SELECT 1 FROM public.platform_owners p WHERE lower(btrim(p.email))=actor_email) THEN RETURN true; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.department_memberships m WHERE m.department_id=department AND m.user_id=recipient::uuid AND m.status='active') THEN RETURN false; END IF;
 SELECT count(*) INTO matches FROM firehouse.employees e JOIN firehouse.employee_profiles ep ON ep.employee_id=e.id
 WHERE e.active=1 AND lower(btrim(ep.email))=actor_email;
 IF matches<>1 THEN RETURN false; END IF;
 SELECT e.id,p.label rank,coalesce(ep.is_admin,0) is_admin,ep.end_date INTO employee
 FROM firehouse.employees e JOIN firehouse.employee_profiles ep ON ep.employee_id=e.id JOIN firehouse.pay_scales p ON p.id=e.pay_scale_id
 WHERE e.active=1 AND lower(btrim(ep.email))=actor_email;
 IF NOT FOUND THEN RETURN false; END IF;
 IF employee.end_date IS NOT NULL AND employee.end_date<>'' AND employee.end_date<to_char(now() AT TIME ZONE 'America/Chicago','YYYY-MM-DD') THEN RETURN false; END IF;
 SELECT effect INTO effect_value FROM firehouse.employee_permission_overrides WHERE employee_id=employee.id AND permission_key='field_preplans.view';
 IF effect_value='deny' THEN RETURN false; END IF;
 IF effect_value='allow' THEN RETURN true; END IF;
 IF employee.is_admin=1 THEN RETURN true; END IF;
 SELECT allowed=1 INTO saved FROM firehouse.rank_permissions WHERE rank=employee.rank AND permission_key='field_preplans.view';
 IF FOUND THEN RETURN saved; END IF;
 RETURN true; -- All current rank defaults include Respond access.
END $$;

-- Migration-first rollout: only upgraded ingestion opts in, in the SAME
-- transaction as the incident. Old deployed handlers still send directly and
-- must not create a second pending alert during the deployment transition.
CREATE FUNCTION firehouse.enable_cad_push_outbox() RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 PERFORM set_config('firehouse.cad_push_outbox','v1',true);
 RETURN true;
END $$;
CREATE FUNCTION firehouse.enqueue_cad_push() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE event uuid; department constant uuid := '14a76771-4c24-481b-8def-e6cce005c17b';
BEGIN
 IF current_setting('firehouse.cad_push_outbox',true) IS DISTINCT FROM 'v1' THEN RETURN NULL; END IF;
 IF NEW.active IS DISTINCT FROM 1 THEN RETURN NULL; END IF;
 INSERT INTO firehouse.cad_push_events(department_id,incident_id,payload)
 VALUES(department,NEW.incident_id,jsonb_build_object('incidentId',NEW.incident_id,'callType',coalesce(NEW.call_type,''),'timeOut',coalesce(NEW.time_out,''),'narrative',left(coalesce(NEW.narrative,''),1000)))
 ON CONFLICT(department_id,incident_id) DO NOTHING RETURNING id INTO event;
 IF event IS NULL THEN RETURN NULL; END IF;
 INSERT INTO firehouse.cad_push_deliveries(event_id,subscription_id,recipient_id,credential_fingerprint)
 SELECT event,s.id,s.user_id,md5(jsonb_build_array(s.endpoint,s.p256dh,s.auth)::text)
 FROM firehouse.push_subscriptions s WHERE s.department_id=department::text AND s.active=1
 AND firehouse.cad_push_recipient_allowed(department,s.user_id)
 ON CONFLICT(event_id,subscription_id) DO NOTHING;
 RETURN NULL;
END $$;
CREATE TRIGGER cad_push_on_new_incident AFTER INSERT ON firehouse.dispatch_incidents
 FOR EACH ROW EXECUTE FUNCTION firehouse.enqueue_cad_push();

CREATE FUNCTION firehouse.claim_cad_push(batch_size integer DEFAULT 50, incident text DEFAULT NULL)
RETURNS SETOF jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 -- Only the small indexed outstanding queue is examined, not accepted history.
 UPDATE firehouse.cad_push_deliveries SET state='expired',lease_token=NULL
 WHERE state IN ('pending','sending','retry') AND next_attempt_at<=now() AND expires_at<=now();
 RETURN QUERY
 WITH candidates AS (
   SELECT d.id FROM firehouse.cad_push_deliveries d JOIN firehouse.cad_push_events e ON e.id=d.event_id
   WHERE d.state IN ('pending','sending','retry') AND d.next_attempt_at<=now()
     AND (incident IS NULL OR e.incident_id=incident)
   ORDER BY d.next_attempt_at,d.id LIMIT least(greatest(batch_size,1),50) FOR UPDATE OF d SKIP LOCKED
 ), claimed AS (
   UPDATE firehouse.cad_push_deliveries d SET
     state=CASE WHEN d.attempts>=5 THEN 'failed' WHEN EXISTS(
       SELECT 1 FROM firehouse.push_subscriptions s JOIN firehouse.cad_push_events e ON e.id=d.event_id
       WHERE s.id=d.subscription_id AND s.active=1 AND s.user_id=d.recipient_id AND s.department_id=e.department_id::text
       AND md5(jsonb_build_array(s.endpoint,s.p256dh,s.auth)::text)=d.credential_fingerprint
       AND firehouse.cad_push_recipient_allowed(e.department_id,s.user_id)
     ) THEN 'sending' ELSE 'cancelled' END,
     attempts=d.attempts+1, lease_token=gen_random_uuid(),next_attempt_at=now()+interval '60 seconds'
   FROM candidates c WHERE c.id=d.id RETURNING d.*
 ) SELECT jsonb_build_object('id',c.id,'lease',c.lease_token,'eventId',e.id,'departmentId',e.department_id,
   'subscriptionId',s.id,'endpoint',s.endpoint,'p256dh',s.p256dh,'auth',s.auth,'incident',e.payload,
   'ttl',greatest(1,floor(extract(epoch FROM c.expires_at-now()))::integer))
 FROM claimed c JOIN firehouse.cad_push_events e ON e.id=c.event_id JOIN firehouse.push_subscriptions s ON s.id=c.subscription_id
 WHERE c.state='sending';
END $$;

CREATE FUNCTION firehouse.finish_cad_push_batch(encoded text) RETURNS integer
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE changed integer;
BEGIN
 WITH outcomes AS (
   SELECT * FROM jsonb_to_recordset(convert_from(decode(encoded,'base64'),'UTF8')::jsonb)
     AS x(id uuid,lease uuid,status integer)
 ), finished AS (
   UPDATE firehouse.cad_push_deliveries d SET
     state=CASE WHEN o.status BETWEEN 200 AND 299 THEN 'accepted'
       WHEN d.expires_at<=now() THEN 'expired'
       WHEN d.attempts>=5 THEN 'failed'
       WHEN o.status=0 OR o.status=429 OR o.status>=500 THEN 'retry' ELSE 'failed' END,
     accepted_at=CASE WHEN o.status BETWEEN 200 AND 299 THEN now() ELSE NULL END,
     last_status_code=o.status,lease_token=NULL,
     next_attempt_at=now()+make_interval(secs=>least(120,15*(2^least(d.attempts,3))::integer))
   FROM outcomes o WHERE d.id=o.id AND d.lease_token=o.lease AND d.state='sending'
   RETURNING d.*
 ), per_subscription AS (
   SELECT subscription_id,recipient_id,credential_fingerprint,
     bool_or(last_status_code IN (404,410)) dead,bool_and(state='accepted') accepted,
     count(*) FILTER(WHERE state<>'accepted') failures,max(last_status_code) status
   FROM finished GROUP BY subscription_id,recipient_id,credential_fingerprint
 ) UPDATE firehouse.push_subscriptions s SET
   active=CASE WHEN p.dead THEN 0 ELSE s.active END,
   failure_count=CASE WHEN p.accepted THEN 0 ELSE s.failure_count+p.failures END,
   last_success_at=CASE WHEN p.accepted THEN now()::text ELSE s.last_success_at END,
   last_error=CASE WHEN p.accepted THEN '' ELSE 'Push provider status '||p.status::text END,updated_at=now()::text
 FROM per_subscription p WHERE s.id=p.subscription_id AND s.user_id=p.recipient_id
 AND md5(jsonb_build_array(s.endpoint,s.p256dh,s.auth)::text)=p.credential_fingerprint;
 GET DIAGNOSTICS changed=ROW_COUNT;
 RETURN changed;
END $$;
REVOKE ALL ON FUNCTION firehouse.cad_push_recipient_allowed(uuid,text),firehouse.enable_cad_push_outbox(),firehouse.enqueue_cad_push(),firehouse.claim_cad_push(integer,text),firehouse.finish_cad_push_batch(text) FROM PUBLIC,anon,authenticated,service_role;
