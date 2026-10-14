-- Owner-private filter preferences, separate from training credit and evidence.
DO $migration$
DECLARE target name;
BEGIN
 FOR target IN SELECT 'firehouse'::name UNION SELECT schema_name FROM private.department_portals LOOP
  EXECUTE format('CREATE TABLE %I.training_report_views (
    department_id text NOT NULL,id text NOT NULL,owner_email text NOT NULL,name text NOT NULL,
    filters text NOT NULL CHECK(length(filters)<=6000),slot integer NOT NULL CHECK(slot BETWEEN 1 AND 20),
    version integer NOT NULL CHECK(version>0),archived integer NOT NULL DEFAULT 0 CHECK(archived IN (0,1)),
    updated_at text NOT NULL,PRIMARY KEY(department_id,id))',target);
  EXECUTE format('CREATE UNIQUE INDEX training_report_views_active_slot ON %I.training_report_views(department_id,owner_email,slot) WHERE archived=0',target);
  EXECUTE format('ALTER TABLE %I.training_report_views ENABLE ROW LEVEL SECURITY',target);
  EXECUTE format('REVOKE ALL ON %I.training_report_views FROM PUBLIC,anon,authenticated,service_role',target);
 END LOOP;
END $migration$;
