-- Tiny durable change revisions, not copies of operational or personnel data.
-- Every source change and its revision commit together. A failed broadcast must
-- NOT roll back a CAD call or inspection; the revision is the catch-up authority.
CREATE TABLE firehouse.operational_revisions (
 department_id uuid NOT NULL REFERENCES public.departments(id),
 section text NOT NULL CHECK(section IN ('respond','dashboard','duties','fleet','chief','staffing','feeds')),
 revision bigint NOT NULL DEFAULT 0, queued boolean NOT NULL DEFAULT true,
 updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(department_id,section)
);
CREATE TABLE firehouse.operational_view_leases (
 department_id uuid NOT NULL REFERENCES public.departments(id), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 scope text NOT NULL CHECK(scope IN ('respond','board')), topic text NOT NULL, expires_at timestamptz NOT NULL,
 PRIMARY KEY(user_id,department_id,scope)
);
CREATE TABLE firehouse.operational_cad_recovery (
 department_id uuid PRIMARY KEY REFERENCES public.departments(id), claimed_at timestamptz NOT NULL
);
CREATE INDEX operational_view_leases_department_idx ON firehouse.operational_view_leases(department_id);
ALTER TABLE firehouse.operational_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE firehouse.operational_view_leases ENABLE ROW LEVEL SECURITY;
ALTER TABLE firehouse.operational_cad_recovery ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON firehouse.operational_revisions,firehouse.operational_view_leases,firehouse.operational_cad_recovery FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON firehouse.operational_view_leases TO authenticated;
CREATE POLICY own_operational_lease ON firehouse.operational_view_leases FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()));
CREATE POLICY receive_operational_changes ON realtime.messages FOR SELECT TO authenticated
 USING(extension='broadcast' AND EXISTS(SELECT 1 FROM firehouse.operational_view_leases lease
 WHERE lease.user_id=(SELECT auth.uid()) AND lease.topic=realtime.topic() AND lease.expires_at>now()));
-- No client INSERT policy. Clients can listen but cannot forge change events.

CREATE FUNCTION firehouse.operational_topic(p_department uuid,p_scope text,p_now timestamptz DEFAULT clock_timestamp())
RETURNS text LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT 'operations:'||p_department::text||':'||p_scope||':'||floor(extract(epoch FROM p_now)/60)::bigint::text
$$;

-- Internal trigger only. Definer rights are needed when an existing, RLS-checked
-- public Inventory mutation updates the private revision/Realtime queue. This
-- function is not an API, accepts no callable SQL input, and is not executable
-- directly by any client role. Source-table RLS and grants remain unchanged.
CREATE FUNCTION firehouse.notify_operational_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE dept uuid; configured uuid; part text; version bigint; event_id uuid; channel text; sent boolean;
BEGIN
 IF current_setting('role',true)='authenticated' AND auth.uid() IS NULL THEN
  RAISE EXCEPTION 'Authenticated source writes require a verified identity';
 END IF;
 IF TG_OP='UPDATE' AND to_jsonb(NEW) IS NOT DISTINCT FROM to_jsonb(OLD) THEN RETURN NULL; END IF;
 SELECT id INTO configured FROM public.departments WHERE slug='stickney-fire-department';
 IF configured IS NULL THEN RAISE EXCEPTION 'Operational department is not configured'; END IF;
 FOR dept IN SELECT DISTINCT value::uuid FROM unnest(CASE WHEN TG_TABLE_SCHEMA='public'
  THEN ARRAY[to_jsonb(NEW)->>'department_id',to_jsonb(OLD)->>'department_id']
  ELSE ARRAY[configured::text] END) d(value) WHERE value IS NOT NULL
 LOOP
  IF dept<>configured THEN CONTINUE; END IF;
  -- Serialize revision locks per department even when a transaction touches
  -- several source tables in a different order. Source rows retain their locks.
  PERFORM pg_advisory_xact_lock(hashtextextended('operational:'||dept::text,0));
  FOR part IN SELECT value FROM unnest(string_to_array(TG_ARGV[0],',')) s(value) ORDER BY value LOOP
   INSERT INTO firehouse.operational_revisions(department_id,section,revision,updated_at) VALUES(dept,part,1,clock_timestamp())
   ON CONFLICT(department_id,section) DO UPDATE SET revision=operational_revisions.revision+1,updated_at=excluded.updated_at
   RETURNING revision INTO version;
   event_id:=gen_random_uuid();
   channel:=firehouse.operational_topic(dept,CASE WHEN part='respond' THEN 'respond' ELSE 'board' END);
   sent:=false;
   BEGIN
    PERFORM realtime.send(jsonb_build_object('id',event_id,'section',part,'revision',version::text),'changed',channel,true);
    SELECT EXISTS(SELECT 1 FROM realtime.messages WHERE inserted_at=transaction_timestamp()::timestamp
     AND topic=channel AND extension='broadcast' AND private IS TRUE AND payload->>'id'=event_id::text) INTO sent;
   EXCEPTION WHEN OTHERS THEN sent:=false;
   END;
   UPDATE firehouse.operational_revisions SET queued=sent WHERE department_id=dept AND section=part;
  END LOOP;
 END LOOP;
 RETURN NULL;
END $$;

CREATE FUNCTION firehouse.issue_operational_view_lease(p_department uuid,p_user uuid,p_scopes text[])
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE checked timestamptz:=clock_timestamp(); scope_name text; results jsonb:='[]'::jsonb; versions jsonb; sent boolean;
 expires timestamptz:=date_trunc('minute',checked)+interval '1 minute'; topic_name text;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.departments WHERE id=p_department AND slug='stickney-fire-department')
  OR p_user IS NULL OR NOT (p_scopes <@ ARRAY['respond','board']::text[]) THEN RAISE EXCEPTION 'Invalid operational view scope'; END IF;
 FOREACH scope_name IN ARRAY p_scopes LOOP
  topic_name:=firehouse.operational_topic(p_department,scope_name,checked);
  INSERT INTO firehouse.operational_view_leases(department_id,user_id,scope,topic,expires_at)
  VALUES(p_department,p_user,scope_name,topic_name,expires)
  ON CONFLICT(user_id,department_id,scope) DO UPDATE SET topic=excluded.topic,expires_at=excluded.expires_at
  WHERE operational_view_leases.topic IS DISTINCT FROM excluded.topic;
  SELECT coalesce(jsonb_object_agg(section,revision::text),'{}'::jsonb),coalesce(bool_and(queued),true) INTO versions,sent
  FROM firehouse.operational_revisions WHERE department_id=p_department AND (CASE WHEN scope_name='respond' THEN section='respond' ELSE section<>'respond' END);
  results:=results||jsonb_build_array(jsonb_build_object('scope',scope_name,'topic',topic_name,'expiresAt',expires,'revisions',versions,'queued',sent));
 END LOOP;
 RETURN jsonb_build_object('departmentId',p_department,'userId',p_user,'serverTime',checked,'leases',results);
END $$;

CREATE FUNCTION firehouse.claim_operational_cad_recovery(p_department uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE changed integer;
BEGIN
 INSERT INTO firehouse.operational_cad_recovery(department_id,claimed_at) VALUES(p_department,clock_timestamp())
 ON CONFLICT(department_id) DO UPDATE SET claimed_at=excluded.claimed_at
 WHERE operational_cad_recovery.claimed_at<=clock_timestamp()-interval '30 seconds';
 GET DIAGNOSTICS changed=ROW_COUNT;
 RETURN changed=1;
END $$;

REVOKE ALL ON FUNCTION firehouse.operational_topic(uuid,text,timestamptz) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION firehouse.notify_operational_change() FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION firehouse.issue_operational_view_lease(uuid,uuid,text[]) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION firehouse.claim_operational_cad_recovery(uuid) FROM PUBLIC,anon,authenticated,service_role;

-- Explicit source coverage: database triggers include every writer (webhooks,
-- imports, background jobs and normal UI saves), not just one browser button.
DO $$ DECLARE source record; BEGIN
 FOR source IN SELECT * FROM (VALUES
 ('firehouse','dispatch_incidents','dashboard,respond'),
 ('firehouse','cad_inbound_receipts','respond'),
 ('firehouse','daily_log_calls','dashboard,respond'),
 ('firehouse','daily_log_staffing','dashboard,staffing'),
 ('firehouse','daily_log_approvals','dashboard'),
 ('firehouse','daily_logs','dashboard'),
 ('firehouse','daily_duties','duties'),
 ('firehouse','road_closures','dashboard,respond'),
 ('firehouse','fleet_apparatus','dashboard,duties,fleet,respond'),
 ('firehouse','employees','chief,dashboard,staffing'),
 ('firehouse','employee_profiles','chief,dashboard,staffing'),
 ('firehouse','pay_scales','chief,dashboard,staffing'),
 ('firehouse','pay_periods','dashboard'),
 ('firehouse','station_shift_slots','dashboard,staffing'),
 ('firehouse','station_schedule_entries','dashboard,staffing'),
 ('firehouse','station_shift_types','dashboard,staffing'),
 ('firehouse','chief_board_items','chief'),
 ('firehouse','chief_board_attachments','chief'),
 ('firehouse','system_meta','chief'),
 ('firehouse','board_feed_cache','feeds'),
 ('firehouse','field_preplans','respond'),
 ('firehouse','field_preplan_features','respond'),
 ('firehouse','field_preplan_photos','respond'),
 ('firehouse','field_preplan_levels','respond'),
 ('firehouse','field_preplan_spaces','respond'),
 ('firehouse','field_preplan_alerts','respond'),
 ('firehouse','field_preplan_hazmat','respond'),
 ('firehouse','field_preplan_hazmat_zones','respond'),
 ('firehouse','field_preplan_hose_lays','respond'),
 ('firehouse','field_preplan_assets','respond'),
 ('firehouse','field_preplan_revisions','respond'),
 ('firehouse','field_preplan_risk_factors','respond'),
 ('firehouse','field_hydrants','respond'),
 ('firehouse','box_cards','respond'),
 ('public','inventory_checks','dashboard,duties'),
 ('public','inventory_check_items','dashboard,duties'),
 ('public','inventory_readiness_exceptions','dashboard'),
 ('public','inventory_equipment','dashboard'),
 ('public','inventory_inspection_schedules','duties'),
 ('public','inventory_apparatus_profiles','dashboard,duties'),
 ('public','department_apparatus','dashboard,duties,fleet')
 ) AS sources(schema_name,table_name,sections) LOOP
  EXECUTE format('CREATE TRIGGER operational_change AFTER INSERT OR UPDATE OR DELETE ON %I.%I FOR EACH ROW EXECUTE FUNCTION firehouse.notify_operational_change(%L)',source.schema_name,source.table_name,source.sections);
 END LOOP;
END $$;
