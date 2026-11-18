-- Additive workspace records. Canonical preplan/hydrant IDs and all existing
-- records remain in their original tables. No source records are seeded here.
DO $migration$
DECLARE s text; t text;
BEGIN
 FOR s IN SELECT nspname FROM pg_namespace WHERE nspname='firehouse' OR nspname ~ '^department_[a-f0-9]{32}$' LOOP
  EXECUTE format('CREATE TABLE IF NOT EXISTS %I.field_preplan_external_details (
   source_system text NOT NULL,external_id text NOT NULL,preplan_id text NOT NULL REFERENCES %I.field_preplans(id),
   payload text NOT NULL,review_notes text NOT NULL DEFAULT '''',imported_at text NOT NULL,
   PRIMARY KEY(source_system,external_id))',s,s);
  EXECUTE format('CREATE INDEX IF NOT EXISTS field_preplan_external_plan_idx ON %I.field_preplan_external_details(preplan_id)',s);
  EXECUTE format('CREATE TABLE IF NOT EXISTS %I.field_hydrant_service_events (
   id text PRIMARY KEY,hydrant_id text NOT NULL REFERENCES %I.field_hydrants(id),
   kind text NOT NULL CHECK(kind IN (''maintenance'',''flow'')),performed_on text,
   flow_gpm double precision CHECK(flow_gpm>=0 AND flow_gpm<=100000),notes text NOT NULL DEFAULT '''',
   actor text NOT NULL,created_at text NOT NULL,source_system text,source_external_id text,
   UNIQUE(source_system,source_external_id))',s,s);
  EXECUTE format('CREATE INDEX IF NOT EXISTS field_hydrant_service_history_idx ON %I.field_hydrant_service_events(hydrant_id,performed_on DESC,created_at DESC)',s);
  EXECUTE format('CREATE TABLE IF NOT EXISTS %I.field_preplan_observations (
   id text PRIMARY KEY,preplan_id text REFERENCES %I.field_preplans(id),address text NOT NULL,
   note text NOT NULL,priority text NOT NULL CHECK(priority IN (''routine'',''urgent'')),
   photo_key text,photo_type text,photo_name text,status text NOT NULL DEFAULT ''pending'',
   actor text NOT NULL,created_at text NOT NULL)',s,s);
  EXECUTE format('CREATE INDEX IF NOT EXISTS field_observation_plan_idx ON %I.field_preplan_observations(preplan_id,created_at DESC)',s);
  FOREACH t IN ARRAY ARRAY['field_preplan_external_details','field_hydrant_service_events','field_preplan_observations'] LOOP
   EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY',s,t);
   EXECUTE format('REVOKE ALL ON %I.%I FROM PUBLIC,anon',s,t);
   EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON %I.%I TO authenticated',s,t);
   EXECUTE format('CREATE POLICY field_workspace_department_access ON %I.%I FOR ALL TO authenticated USING ((SELECT %I.has_department_access())) WITH CHECK ((SELECT %I.has_department_access()))',s,t,s,s);
  END LOOP;
 END LOOP;
END $migration$;
