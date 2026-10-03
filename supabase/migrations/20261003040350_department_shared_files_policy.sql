CREATE FUNCTION private.shared_preplan_storage_read(p_name text) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $body$
DECLARE item record; found boolean; prefix text;
BEGIN
 IF NOT private.portal_server_request() OR auth.uid() IS NULL OR NOT (public.is_platform_owner() OR EXISTS(SELECT 1 FROM public.department_memberships WHERE user_id=auth.uid() AND status='active')) THEN RETURN false; END IF;
 FOR item IN SELECT department_id,schema_name FROM private.department_portals LOOP
   prefix:=CASE WHEN item.schema_name='firehouse' THEN '' ELSE 'departments/'||item.department_id::text||'/' END;
   EXECUTE format($sql$SELECT EXISTS(SELECT 1 FROM %1$I.field_preplan_photos f JOIN %1$I.field_preplans p ON p.id=f.preplan_id WHERE p.publication_status='published' AND $1||f.object_key=$2)
   OR EXISTS(SELECT 1 FROM %1$I.field_preplan_assets f JOIN %1$I.field_preplans p ON p.id=f.preplan_id WHERE p.publication_status='published' AND f.archived=0 AND $1||f.object_key=$2)$sql$,item.schema_name) INTO found USING prefix,p_name;
   IF found THEN RETURN true; END IF;
 END LOOP;
 RETURN false;
END $body$;
REVOKE ALL ON FUNCTION private.shared_preplan_storage_read(text) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION private.shared_preplan_storage_read(text) TO authenticated;
CREATE POLICY shared_published_preplan_files_read ON storage.objects FOR SELECT TO authenticated USING (bucket_id='firehouse-portal' AND private.shared_preplan_storage_read(name));

-- Close the reverse direction too: the legacy executor may never address a
-- newly provisioned department's schema or privileged gateway explicitly.
DO $body$
DECLARE f record; definition text;
BEGIN
 FOR f IN SELECT pg_get_functiondef(p.oid) def FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='firehouse' AND p.proname IN ('execute_portal_sql','execute_server_portal_sql') LOOP
   definition:=replace(f.def,'IF p_sql IS NULL',$insert$IF p_sql ~* '\m(department_[a-f0-9]{32}|department_gateway|private)\s*\.' OR p_sql ~* '"(department_[a-f0-9]{32}|department_gateway|private)"\s*\.' THEN
    RAISE EXCEPTION 'Cross-department query denied' USING ERRCODE='42501';
   END IF;
   IF p_sql IS NULL$insert$);
   EXECUTE definition;
 END LOOP;
END $body$;
NOTIFY pgrst,'reload schema';
