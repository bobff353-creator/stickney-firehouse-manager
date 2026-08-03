INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('firehouse-portal', 'firehouse-portal', false, 26214400)
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = EXCLUDED.file_size_limit;

DROP POLICY IF EXISTS "stickney_firehouse_portal_read" ON storage.objects;
CREATE POLICY "stickney_firehouse_portal_read"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'firehouse-portal' AND (SELECT firehouse.has_department_access()));

DROP POLICY IF EXISTS "stickney_firehouse_portal_insert" ON storage.objects;
CREATE POLICY "stickney_firehouse_portal_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'firehouse-portal' AND (SELECT firehouse.has_department_access()));

DROP POLICY IF EXISTS "stickney_firehouse_portal_update" ON storage.objects;
CREATE POLICY "stickney_firehouse_portal_update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'firehouse-portal' AND (SELECT firehouse.has_department_access()))
WITH CHECK (bucket_id = 'firehouse-portal' AND (SELECT firehouse.has_department_access()));

DROP POLICY IF EXISTS "stickney_firehouse_portal_delete" ON storage.objects;
CREATE POLICY "stickney_firehouse_portal_delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'firehouse-portal' AND (SELECT firehouse.has_department_access()));
