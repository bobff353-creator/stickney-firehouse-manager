-- Preserve ESO originals separately from visits performed in this app.
CREATE TABLE firehouse.fire_inspection_eso_records (
 department_id text NOT NULL, inspection_id text NOT NULL, sha256 text NOT NULL,
 object_key text NOT NULL UNIQUE, summary text NOT NULL, imported_at text NOT NULL,
 imported_by text NOT NULL, PRIMARY KEY(department_id,inspection_id)
);
CREATE TABLE firehouse.fire_inspection_eso_files (
 department_id text NOT NULL, attachment_id text NOT NULL, sha256 text NOT NULL,
 object_key text NOT NULL UNIQUE, filename text NOT NULL, content_type text NOT NULL,
 size_bytes integer NOT NULL CHECK(size_bytes>0 AND size_bytes<=16777216),
 imported_at text NOT NULL, PRIMARY KEY(department_id,attachment_id)
);
ALTER TABLE firehouse.fire_inspection_eso_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE firehouse.fire_inspection_eso_files ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON firehouse.fire_inspection_eso_records,firehouse.fire_inspection_eso_files FROM PUBLIC,anon,authenticated;
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('stickney-fire-inspections-eso','stickney-fire-inspections-eso',false,16777216,
 ARRAY['application/json','application/pdf','image/jpeg','image/png','image/webp'])
ON CONFLICT(id) DO NOTHING;
CREATE POLICY fire_inspection_eso_read ON storage.objects FOR SELECT TO authenticated
 USING(bucket_id='stickney-fire-inspections-eso' AND (SELECT private.fire_inspection_pilot_allowed())
 AND split_part(name,'/',1) IN(SELECT public.current_department_ids()::text));
CREATE POLICY fire_inspection_eso_insert ON storage.objects FOR INSERT TO authenticated
 WITH CHECK(bucket_id='stickney-fire-inspections-eso' AND (SELECT private.fire_inspection_pilot_allowed())
 AND split_part(name,'/',1) IN(SELECT public.current_department_ids()::text));
-- No replacement or deletion policy: a retry must match the preserved original.
