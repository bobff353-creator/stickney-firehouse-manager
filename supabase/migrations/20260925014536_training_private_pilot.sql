-- Private owner pilot. No changes to payroll, schedules, or existing training feeds.
CREATE TABLE firehouse.training_pilot_records (
 id text PRIMARY KEY, department_id text NOT NULL, kind text NOT NULL CHECK(kind IN ('activity','completion','assignment','credential','proficiency','group','resource')),
 payload text NOT NULL CHECK(length(payload)<=90000), version integer NOT NULL DEFAULT 1 CHECK(version>0),
 archived integer NOT NULL DEFAULT 0 CHECK(archived IN(0,1)), created_at text NOT NULL,updated_at text NOT NULL,updated_by text NOT NULL
);
CREATE INDEX training_pilot_records_department ON firehouse.training_pilot_records(department_id,updated_at DESC);
CREATE TABLE firehouse.training_pilot_audit (
 id text PRIMARY KEY,department_id text NOT NULL,record_id text NOT NULL REFERENCES firehouse.training_pilot_records(id),version integer NOT NULL,
 kind text NOT NULL,payload text NOT NULL,archived integer NOT NULL,actor text NOT NULL,created_at text NOT NULL,
 UNIQUE(record_id,version)
);
CREATE INDEX training_pilot_audit_department ON firehouse.training_pilot_audit(department_id,record_id,version DESC);
CREATE TABLE firehouse.training_pilot_files (
 id text PRIMARY KEY,department_id text NOT NULL,record_id text NOT NULL REFERENCES firehouse.training_pilot_records(id),
 object_key text NOT NULL UNIQUE,filename text NOT NULL,content_type text NOT NULL,size_bytes integer NOT NULL CHECK(size_bytes>0 AND size_bytes<=4194304),
 created_at text NOT NULL,created_by text NOT NULL
);
CREATE INDEX training_pilot_files_department ON firehouse.training_pilot_files(department_id,record_id);
CREATE INDEX training_pilot_files_record ON firehouse.training_pilot_files(record_id);
ALTER TABLE firehouse.training_pilot_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE firehouse.training_pilot_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE firehouse.training_pilot_files ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON firehouse.training_pilot_records,firehouse.training_pilot_audit,firehouse.training_pilot_files FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION private.training_pilot_allowed() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT private.portal_server_request() AND firehouse.has_department_access()
 AND EXISTS(SELECT 1 FROM auth.users WHERE id=(SELECT auth.uid()) AND lower(btrim(email))='bobff353@gmail.com')
$$;
REVOKE ALL ON FUNCTION private.training_pilot_allowed() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.training_pilot_allowed() TO authenticated;
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('stickney-training-pilot','stickney-training-pilot',false,4194304,ARRAY['application/pdf','image/jpeg','image/png','image/webp'])
ON CONFLICT(id) DO NOTHING;
CREATE POLICY training_pilot_storage_read ON storage.objects FOR SELECT TO authenticated
 USING(bucket_id='stickney-training-pilot' AND (SELECT private.training_pilot_allowed()));
CREATE POLICY training_pilot_storage_insert ON storage.objects FOR INSERT TO authenticated
 WITH CHECK(bucket_id='stickney-training-pilot' AND (SELECT private.training_pilot_allowed()));
CREATE POLICY training_pilot_storage_delete ON storage.objects FOR DELETE TO authenticated
 USING(bucket_id='stickney-training-pilot' AND (SELECT private.training_pilot_allowed()));
