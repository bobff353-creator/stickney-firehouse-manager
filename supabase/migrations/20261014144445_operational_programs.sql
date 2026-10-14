-- Department programs use the existing verified portal SQL boundary.
-- No direct Data API grants and no seeded operational records.
DO $migration$
DECLARE target name;
BEGIN
  FOR target IN SELECT 'firehouse'::name UNION SELECT schema_name FROM private.department_portals LOOP
    EXECUTE format('CREATE TABLE %I.operational_program_records (
      department_id uuid NOT NULL, id text NOT NULL, kind text NOT NULL CHECK(kind IN (''hydrants'',''outreach'',''replacement'')),
      payload text NOT NULL, version integer NOT NULL CHECK(version>0), updated_at text NOT NULL,
      updated_by text NOT NULL, PRIMARY KEY(department_id,id))', target);
    EXECUTE format('CREATE TABLE %I.operational_program_audit (
      department_id uuid NOT NULL, record_id text NOT NULL, version integer NOT NULL,
      kind text NOT NULL, payload text NOT NULL, actor text NOT NULL, created_at text NOT NULL,
      PRIMARY KEY(department_id,record_id,version),
      FOREIGN KEY(department_id,record_id) REFERENCES %I.operational_program_records(department_id,id) ON DELETE RESTRICT)',target,target);
    EXECUTE format('ALTER TABLE %I.operational_program_records ENABLE ROW LEVEL SECURITY',target);
    EXECUTE format('ALTER TABLE %I.operational_program_audit ENABLE ROW LEVEL SECURITY',target);
    EXECUTE format('REVOKE ALL ON %I.operational_program_records,%I.operational_program_audit FROM PUBLIC,anon,authenticated,service_role',target,target);
  END LOOP;
END $migration$;
