-- Arrival working copies, events and private-file references. Existing department
-- records and storage objects are preserved; no legacy rows are changed here.
DO $migration$
DECLARE s text;
BEGIN
 FOR s IN SELECT nspname FROM pg_namespace WHERE nspname='firehouse' OR nspname ~ '^department_[a-f0-9]{32}$' LOOP
  EXECUTE format('CREATE TABLE IF NOT EXISTS %I.arrival_preplan_records (
    kind text NOT NULL CHECK(kind IN (''plan'',''event'',''file'',''observation'',''observation_event'',''hydrant_activity'',''import'')),
    id text NOT NULL, parent_id text, revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
    payload text NOT NULL, created_by text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(kind,id)
  )',s);
  EXECUTE format('CREATE INDEX IF NOT EXISTS arrival_preplan_parent_idx ON %I.arrival_preplan_records(kind,parent_id,updated_at DESC)',s);
  EXECUTE format('ALTER TABLE %I.arrival_preplan_records ENABLE ROW LEVEL SECURITY',s);
  EXECUTE format('REVOKE ALL ON %I.arrival_preplan_records FROM public,anon',s);
  EXECUTE format('GRANT SELECT,INSERT,UPDATE ON %I.arrival_preplan_records TO authenticated',s);
  EXECUTE format('CREATE POLICY arrival_department_access ON %I.arrival_preplan_records FOR ALL TO authenticated USING ((SELECT %I.has_department_access())) WITH CHECK ((SELECT %I.has_department_access()))',s,s,s);
  EXECUTE format('CREATE POLICY arrival_server_boundary ON %I.arrival_preplan_records AS RESTRICTIVE FOR ALL TO authenticated USING ((SELECT private.portal_server_request())) WITH CHECK ((SELECT private.portal_server_request()))',s);
 END LOOP;
END $migration$;
