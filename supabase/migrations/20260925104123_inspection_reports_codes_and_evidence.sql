CREATE TABLE firehouse.fire_inspection_code_entries (
 id text PRIMARY KEY, department_id text NOT NULL, payload text NOT NULL CHECK(length(payload)<=60000),
 version integer NOT NULL DEFAULT 1, archived integer NOT NULL DEFAULT 0,
 updated_at text NOT NULL, updated_by text NOT NULL
);
CREATE INDEX inspection_code_department ON firehouse.fire_inspection_code_entries(department_id,updated_at DESC);
CREATE TABLE firehouse.fire_inspection_code_audit (
 id text PRIMARY KEY, department_id text NOT NULL, code_id text NOT NULL REFERENCES firehouse.fire_inspection_code_entries(id),
 version integer NOT NULL, payload text NOT NULL, archived integer NOT NULL, actor text NOT NULL, created_at text NOT NULL,
 UNIQUE(code_id,version)
);
ALTER TABLE firehouse.fire_inspection_pilot_files ALTER COLUMN record_id DROP NOT NULL;
ALTER TABLE firehouse.fire_inspection_pilot_files ADD COLUMN code_id text REFERENCES firehouse.fire_inspection_code_entries(id);
ALTER TABLE firehouse.fire_inspection_pilot_files ADD COLUMN check_id text NOT NULL DEFAULT '';
ALTER TABLE firehouse.fire_inspection_pilot_files ADD COLUMN caption text NOT NULL DEFAULT '';
ALTER TABLE firehouse.fire_inspection_pilot_files ADD COLUMN record_version integer;
ALTER TABLE firehouse.fire_inspection_pilot_files ADD CONSTRAINT inspection_file_target CHECK((record_id IS NOT NULL)::int+(code_id IS NOT NULL)::int=1);
CREATE INDEX inspection_files_code ON firehouse.fire_inspection_pilot_files(code_id);
CREATE TABLE firehouse.fire_inspection_email_deliveries (
 id text PRIMARY KEY, department_id text NOT NULL, record_id text NOT NULL REFERENCES firehouse.fire_inspection_pilot_records(id),
 record_version integer NOT NULL, recipient text NOT NULL, sender text NOT NULL, subject text NOT NULL,
 report_text text NOT NULL, pdf_key text NOT NULL, provider_id text, status text NOT NULL DEFAULT 'Prepared',
 error text NOT NULL DEFAULT '', created_at text NOT NULL, updated_at text NOT NULL, created_by text NOT NULL,
 UNIQUE(record_id,record_version,recipient)
);
CREATE INDEX inspection_email_department ON firehouse.fire_inspection_email_deliveries(department_id,record_id,created_at DESC);
ALTER TABLE firehouse.fire_inspection_code_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE firehouse.fire_inspection_code_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE firehouse.fire_inspection_email_deliveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON firehouse.fire_inspection_code_entries,firehouse.fire_inspection_code_audit,firehouse.fire_inspection_email_deliveries FROM PUBLIC,anon,authenticated;
