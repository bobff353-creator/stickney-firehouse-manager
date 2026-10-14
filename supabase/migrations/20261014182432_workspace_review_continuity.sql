-- Owner-private reviewed links and preferences; operational sources stay separate.
DO $migration$
DECLARE target name;
BEGIN
 FOR target IN SELECT 'firehouse'::name UNION SELECT schema_name FROM private.department_portals LOOP
  EXECUTE format('CREATE TABLE %I.workspace_review_records (
   department_id text NOT NULL,id text NOT NULL,kind text NOT NULL CHECK(kind IN (''property_incident'',''review_plan'',''hydrant_view'',''command_snapshot'')),
   subject_id text NOT NULL,payload text NOT NULL CHECK(length(payload)<=200000),version integer NOT NULL CHECK(version>0),updated_at text NOT NULL,actor text NOT NULL,
   PRIMARY KEY(department_id,id),UNIQUE(department_id,kind,subject_id))',target);
  EXECUTE format('CREATE TABLE %I.workspace_review_audit (department_id text NOT NULL,record_id text NOT NULL,version integer NOT NULL,kind text NOT NULL,subject_id text NOT NULL,payload text NOT NULL,created_at text NOT NULL,actor text NOT NULL,PRIMARY KEY(department_id,record_id,version))',target);
  EXECUTE format('ALTER TABLE %I.workspace_review_records ENABLE ROW LEVEL SECURITY',target);
  EXECUTE format('ALTER TABLE %I.workspace_review_audit ENABLE ROW LEVEL SECURITY',target);
  EXECUTE format('REVOKE ALL ON %I.workspace_review_records,%I.workspace_review_audit FROM PUBLIC,anon,authenticated,service_role',target,target);
 END LOOP;
END $migration$;
