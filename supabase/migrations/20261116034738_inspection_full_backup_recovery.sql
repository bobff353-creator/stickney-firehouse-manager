-- Additive native inspection backup schema. Apply through a reviewed migration.
CREATE TABLE firehouse.fire_inspection_backup_jobs (
 department_id text NOT NULL,id text NOT NULL,kind text NOT NULL,state text NOT NULL,actor text NOT NULL,
 created_at text NOT NULL,updated_at text NOT NULL,lease_until bigint NOT NULL DEFAULT 0,lease_token text NOT NULL DEFAULT '',
 config text NOT NULL,summary text NOT NULL,manifest_hash text,error text,
 PRIMARY KEY(department_id,id)
);
CREATE INDEX fire_inspection_backup_jobs_department_updated ON firehouse.fire_inspection_backup_jobs(department_id,updated_at DESC,id);
CREATE INDEX fire_inspection_backup_jobs_department_state ON firehouse.fire_inspection_backup_jobs(department_id,kind,state);
CREATE TABLE firehouse.fire_inspection_backup_rows (
 department_id text NOT NULL,job_id text NOT NULL,dataset text NOT NULL,entry_key text NOT NULL,row_json text NOT NULL,
 plan_status text NOT NULL DEFAULT '',applied integer NOT NULL DEFAULT 0,
 PRIMARY KEY(department_id,job_id,dataset,entry_key),
 FOREIGN KEY(department_id,job_id) REFERENCES firehouse.fire_inspection_backup_jobs(department_id,id)
);
CREATE TABLE firehouse.fire_inspection_backup_entries (
 department_id text NOT NULL,job_id text NOT NULL,path text NOT NULL,part_key text NOT NULL,
 size_bytes integer NOT NULL,sha256 text NOT NULL,crc32 bigint NOT NULL,details text NOT NULL,
 PRIMARY KEY(department_id,job_id,path),
 FOREIGN KEY(department_id,job_id) REFERENCES firehouse.fire_inspection_backup_jobs(department_id,id)
);
ALTER TABLE firehouse.fire_inspection_backup_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE firehouse.fire_inspection_backup_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE firehouse.fire_inspection_backup_entries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON firehouse.fire_inspection_backup_jobs,firehouse.fire_inspection_backup_rows,firehouse.fire_inspection_backup_entries FROM PUBLIC,anon,authenticated;
CREATE TABLE firehouse.fire_inspection_backup_audit (
 department_id text NOT NULL,id text NOT NULL,job_id text NOT NULL,action text NOT NULL,actor text NOT NULL,
 reason text NOT NULL,created_at text NOT NULL,PRIMARY KEY(department_id,id)
);
ALTER TABLE firehouse.fire_inspection_backup_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON firehouse.fire_inspection_backup_audit FROM PUBLIC,anon,authenticated;
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('stickney-fire-inspections-backups','stickney-fire-inspections-backups',false,33554432,ARRAY['application/octet-stream','application/json'])
ON CONFLICT(id) DO NOTHING;
CREATE POLICY fire_inspection_backup_storage_read ON storage.objects FOR SELECT TO authenticated
 USING(bucket_id='stickney-fire-inspections-backups' AND (SELECT private.fire_inspection_pilot_allowed()) AND split_part(name,'/',1) IN(SELECT public.current_department_ids()::text));
CREATE POLICY fire_inspection_backup_storage_insert ON storage.objects FOR INSERT TO authenticated
 WITH CHECK(bucket_id='stickney-fire-inspections-backups' AND (SELECT private.fire_inspection_pilot_allowed()) AND split_part(name,'/',1) IN(SELECT public.current_department_ids()::text));
-- No replacement/delete policy: retries must match existing checksum-addressed bytes.
