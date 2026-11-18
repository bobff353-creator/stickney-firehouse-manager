-- New field-workspace tables are accessible only through the existing signed
-- portal server boundary, in addition to their department membership policies.
DO $migration$
DECLARE s text; t text;
BEGIN
 FOR s IN SELECT nspname FROM pg_namespace WHERE nspname='firehouse' OR nspname ~ '^department_[a-f0-9]{32}$' LOOP
  FOREACH t IN ARRAY ARRAY['field_preplan_external_details','field_hydrant_service_events','field_preplan_observations'] LOOP
   IF to_regclass(format('%I.%I',s,t)) IS NOT NULL THEN
    EXECUTE format('CREATE POLICY field_workspace_server_boundary ON %I.%I AS RESTRICTIVE FOR ALL TO authenticated USING ((SELECT private.portal_server_request())) WITH CHECK ((SELECT private.portal_server_request()))',s,t);
   END IF;
  END LOOP;
 END LOOP;
END $migration$;
