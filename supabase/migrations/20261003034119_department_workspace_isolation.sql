-- Legacy Stickney rows remain in firehouse. New departments receive only an
-- empty copy of the current structure, never a copy of operational records.
CREATE TABLE private.department_portals (
  department_id uuid PRIMARY KEY REFERENCES public.departments(id),
  schema_name name NOT NULL UNIQUE,
  hostname text UNIQUE,
  published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE private.department_portals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.department_portals FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION private.provision_department_portal() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $body$
DECLARE target text; source_id text; item record; definition text;
BEGIN
 IF NEW.slug='stickney-fire-department' THEN RETURN NEW; END IF;
 target := 'department_'||replace(NEW.id::text,'-','');
 SELECT id::text INTO source_id FROM public.departments WHERE slug='stickney-fire-department';
 EXECUTE format('CREATE SCHEMA %I',target);
 EXECUTE format('REVOKE ALL ON SCHEMA %I FROM PUBLIC,anon,authenticated,service_role',target);
 -- LIKE copies structure and indexes only. No INSERT SELECT from source data.
 FOR item IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='firehouse' AND c.relkind IN ('r','p') ORDER BY c.relname LOOP
   EXECUTE format('CREATE TABLE %I.%I (LIKE firehouse.%I INCLUDING ALL)',target,item.relname,item.relname);
   EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY',target,item.relname);
   EXECUTE format('REVOKE ALL ON %I.%I FROM PUBLIC,anon,authenticated,service_role',target,item.relname);
 END LOOP;
 -- Foreign keys must point at the NEW tables, preserving related records.
 FOR item IN SELECT c.relname,k.conname,pg_get_constraintdef(k.oid) def FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='firehouse' AND k.contype='f' LOOP
   EXECUTE format('ALTER TABLE %I.%I ADD CONSTRAINT %I %s',target,item.relname,item.conname,replace(item.def,'firehouse.',quote_ident(target)||'.'));
 END LOOP;
 PERFORM set_config('check_function_bodies','off',true);
 PERFORM set_config('search_path','public,pg_catalog',true);
 FOR item IN SELECT c.relname,pg_get_viewdef(c.oid,true) def FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='firehouse' AND c.relkind='v' LOOP
   definition:=replace(replace(replace(item.def,'firehouse.',quote_ident(target)||'.'),'stickney-fire-department',NEW.slug),source_id,NEW.id::text);
   EXECUTE format('CREATE VIEW %I.%I WITH (security_invoker=true) AS %s',target,item.relname,definition);
 END LOOP;
 FOR item IN SELECT p.oid,p.proname,pg_get_functiondef(p.oid) def FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='firehouse' AND p.proname NOT IN ('execute_portal_sql','execute_server_portal_sql','system_health_usage') LOOP
   definition := replace(replace(replace(item.def,'firehouse',target),'stickney-fire-department',NEW.slug),source_id,NEW.id::text);
   definition := replace(definition,'private.portal_confirmation_status()',format('public.department_portal_confirmation_status(%L::uuid)',NEW.id));
   EXECUTE definition;
 END LOOP;
 FOR item IN SELECT c.relname,pg_get_triggerdef(t.oid,true) def FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='firehouse' AND NOT t.tgisinternal LOOP
   EXECUTE replace(item.def,'firehouse.',quote_ident(target)||'.');
 END LOOP;
 EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA %I FROM PUBLIC,anon,authenticated,service_role',target);
 EXECUTE format('INSERT INTO %I.system_meta(key,value) VALUES ($1,$2)',target)
 USING 'runtime_bootstrap_version','stickney-runtime-bootstrap-2026-08-31-safety-inspection-library-v2';
 INSERT INTO private.department_portals(department_id,schema_name,hostname)
 VALUES(NEW.id,target,NEW.slug||'-firehouse-manager.vercel.app');
 RETURN NEW;
END $body$;
REVOKE ALL ON FUNCTION private.provision_department_portal() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER provision_department_portal AFTER INSERT ON public.departments FOR EACH ROW EXECUTE FUNCTION private.provision_department_portal();

CREATE FUNCTION public.department_portal_for_host(p_host text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $body$
 SELECT jsonb_build_object('id',d.id,'name',d.name,'slug',d.slug,'isolated',p.schema_name IS DISTINCT FROM 'firehouse'::name)
 FROM private.department_portals p JOIN public.departments d ON d.id=p.department_id
 WHERE p.published AND (p.hostname=lower(p_host) OR (p.schema_name='firehouse' AND
 (p_host IN ('localhost','127.0.0.1') OR p_host ~ '^stickney-firehouse-manager(-[a-z0-9-]+)?[.]vercel[.]app$')))
 LIMIT 1;
$body$;
REVOKE ALL ON FUNCTION public.department_portal_for_host(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.department_portal_for_host(text) TO anon,authenticated;

CREATE FUNCTION private.department_portal_access(p_department uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $body$
 SELECT auth.uid() IS NOT NULL AND (public.is_platform_owner() OR EXISTS (
 SELECT 1 FROM public.department_memberships m WHERE m.department_id=p_department AND m.user_id=auth.uid() AND m.status='active'));
$body$;
REVOKE ALL ON FUNCTION private.department_portal_access(uuid) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION private.department_execute_sql(p_department uuid,p_sql text,p_mode text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $body$
DECLARE target name; result jsonb; affected bigint; forbidden text;
BEGIN
 SELECT schema_name INTO target FROM private.department_portals WHERE department_id=p_department AND schema_name<>'firehouse';
 IF target IS NULL THEN RAISE EXCEPTION 'Department storage is unavailable'; END IF;
 IF p_sql IS NULL OR length(p_sql)>200000 OR p_sql ~ '(;|--|/\*|\*/)' OR p_sql !~* '^\s*(select|insert|update|delete|with)\M'
 OR p_sql ~* '\m(create|alter|drop|truncate|grant|revoke|copy|call|show|reset|listen|notify|vacuum|analyze|set_config|dblink|pg_read_file)\M' THEN RAISE EXCEPTION 'Unsupported portal query'; END IF;
 -- Never allow this executor to select another schema explicitly.
 FOR forbidden IN SELECT nspname FROM pg_namespace WHERE nspname<>target AND nspname<>'pg_temp' LOOP
   IF p_sql ~* ('\m'||forbidden||'\s*\.') OR position('"'||forbidden||'".' in lower(p_sql))>0 THEN RAISE EXCEPTION 'Cross-department query denied' USING ERRCODE='42501'; END IF;
 END LOOP;
 PERFORM set_config('search_path',format('%I,extensions,pg_temp',target),true);
 IF p_mode='all' THEN EXECUTE 'SELECT coalesce(jsonb_agg(to_jsonb(r)),''[]''::jsonb) FROM ('||p_sql||') r' INTO result; RETURN result;
 ELSIF p_mode='first' THEN EXECUTE 'SELECT to_jsonb(r) FROM ('||p_sql||') r LIMIT 1' INTO result; RETURN result;
 ELSIF p_mode='run' THEN EXECUTE p_sql; GET DIAGNOSTICS affected=ROW_COUNT; RETURN jsonb_build_object('success',true,'meta',jsonb_build_object('changes',affected)); END IF;
 RAISE EXCEPTION 'Unknown query mode';
END $body$;
REVOKE ALL ON FUNCTION private.department_execute_sql(uuid,text,text) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.department_firehouse_sql(p_department uuid,p_sql text,p_mode text DEFAULT 'all',p_secret text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $body$
BEGIN
 IF NOT private.portal_server_request() OR NOT private.department_portal_access(p_department) THEN RAISE EXCEPTION 'Verified department portal access required' USING ERRCODE='42501'; END IF;
 RETURN private.department_execute_sql(p_department,p_sql,p_mode);
END $body$;
REVOKE ALL ON FUNCTION public.department_firehouse_sql(uuid,text,text,text) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.department_firehouse_sql(uuid,text,text,text) TO authenticated;

CREATE FUNCTION public.department_firehouse_server_sql(p_department uuid,p_sql text,p_mode text DEFAULT 'all',p_secret text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $body$
BEGIN
 -- Validate the existing server credential without reading any source rows.
 PERFORM public.firehouse_server_sql('SELECT 1','first',p_secret);
 RETURN private.department_execute_sql(p_department,p_sql,p_mode);
END $body$;
REVOKE ALL ON FUNCTION public.department_firehouse_server_sql(uuid,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.department_firehouse_server_sql(uuid,text,text,text) TO anon,authenticated;

CREATE FUNCTION public.department_firehouse_sql_batch(p_department uuid,p_statements jsonb,p_secret text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SET search_path='' AS $body$
DECLARE item jsonb; result jsonb; results jsonb:='[]';
BEGIN
 PERFORM public.department_firehouse_sql(p_department,'SELECT 1','first',p_secret);
 IF jsonb_typeof(p_statements) IS DISTINCT FROM 'array' OR jsonb_array_length(p_statements)>2000 THEN RAISE EXCEPTION 'Invalid transaction'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_department::text,0));
 FOR item IN SELECT value FROM jsonb_array_elements(p_statements) LOOP
   result := public.department_firehouse_sql(p_department,item->>'sql',coalesce(item->>'mode','run'),p_secret);
   IF item->>'requiredChanges' IS NOT NULL AND (result#>>'{meta,changes}')::bigint IS DISTINCT FROM (item->>'requiredChanges')::bigint THEN RAISE EXCEPTION 'SAVE_CONFLICT' USING ERRCODE='PT409'; END IF;
   results:=results||jsonb_build_array(result);
 END LOOP;
 RETURN results;
END $body$;
REVOKE ALL ON FUNCTION public.department_firehouse_sql_batch(uuid,jsonb,text) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.department_firehouse_sql_batch(uuid,jsonb,text) TO authenticated;

CREATE FUNCTION public.department_portal_confirmation_status(p_department uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $body$
DECLARE target name; result jsonb;
BEGIN
 IF NOT private.department_portal_access(p_department) THEN RAISE EXCEPTION 'Department access required' USING ERRCODE='42501'; END IF;
 SELECT schema_name INTO target FROM private.department_portals WHERE department_id=p_department AND schema_name<>'firehouse';
 IF target IS NULL THEN RAISE EXCEPTION 'Department storage is unavailable'; END IF;
 EXECUTE format('SELECT jsonb_build_object(''required'',coalesce(m.enabled,false) AND NOT EXISTS(SELECT 1 FROM %I.portal_confirmation_receipts r WHERE r.message_id=m.id AND r.user_id=$2),''version'',m.id,''exempt'',false) FROM %I.portal_confirmation_setting s LEFT JOIN %I.portal_confirmation_messages m ON m.id=s.message_id WHERE s.department_id=$1',target,target,target) INTO result USING p_department,auth.uid();
 RETURN coalesce(result,jsonb_build_object('required',false,'version',null,'exempt',false));
END $body$;
REVOKE ALL ON FUNCTION public.department_portal_confirmation_status(uuid) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.department_portal_confirmation_status(uuid) TO authenticated;

-- Register existing departments without copying any legacy operational rows.
INSERT INTO private.department_portals(department_id,schema_name,hostname,published)
SELECT id,'firehouse','stickney-firehouse-manager.vercel.app',true FROM public.departments WHERE slug='stickney-fire-department';
CREATE TRIGGER backfill_department_portal AFTER UPDATE ON public.departments FOR EACH ROW WHEN (NEW.slug<>'stickney-fire-department') EXECUTE FUNCTION private.provision_department_portal();
 UPDATE public.departments SET name=name WHERE slug<>'stickney-fire-department';
DROP TRIGGER backfill_department_portal ON public.departments;
UPDATE private.department_portals SET published=true WHERE department_id IN (SELECT id FROM public.departments WHERE slug='test');
NOTIFY pgrst,'reload schema';

CREATE FUNCTION public.department_portal_directory() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $body$
DECLARE department record; plans bigint; hydrants bigint; results jsonb:='[]';
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required' USING ERRCODE='42501'; END IF;
 FOR department IN SELECT d.id,d.name,d.slug,d.city,d.state,d.county,d.account_status,d.trial_status,m.role,p.schema_name,p.hostname,p.published
 FROM public.departments d JOIN private.department_portals p ON p.department_id=d.id
 LEFT JOIN public.department_memberships m ON m.department_id=d.id AND m.user_id=auth.uid() AND m.status='active'
 WHERE public.is_platform_owner() OR m.user_id IS NOT NULL ORDER BY d.created_at LOOP
   EXECUTE format('SELECT count(*) FROM %I.field_preplans',department.schema_name) INTO plans;
   EXECUTE format('SELECT count(*) FROM %I.field_hydrants',department.schema_name) INTO hydrants;
   results:=results||jsonb_build_array(jsonb_build_object('role',coalesce(department.role,'owner'),'status','active',
   'departments',to_jsonb(department)-'role'-'schema_name'-'hostname'-'published',
   'portalUrl',CASE WHEN department.published THEN 'https://'||department.hostname||'/?display=portal' ELSE NULL END,
   'properties',plans,'hydrants',hydrants));
 END LOOP;
 RETURN results;
END $body$;
REVOKE ALL ON FUNCTION public.department_portal_directory() FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.department_portal_directory() TO authenticated;

CREATE FUNCTION public.department_shared_preplans(p_viewer uuid,p_source uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $body$
DECLARE item record; plans jsonb; hydrants jsonb; results jsonb:='[]';
BEGIN
 IF NOT private.portal_server_request() OR NOT private.department_portal_access(p_viewer) THEN RAISE EXCEPTION 'Verified department access required' USING ERRCODE='42501'; END IF;
 FOR item IN SELECT d.id,d.name,p.schema_name FROM public.departments d JOIN private.department_portals p ON p.department_id=d.id WHERE d.id<>p_viewer AND (p_source IS NULL OR d.id=p_source) ORDER BY d.name LOOP
   EXECUTE format('SELECT coalesce(jsonb_agg(to_jsonb(p)-''created_by''-''updated_by''-''draft_owner''-''published_by''-''archived_by''),''[]''::jsonb) FROM %I.field_preplans p WHERE publication_status=''published''',item.schema_name) INTO plans;
   EXECUTE format('SELECT coalesce(jsonb_agg(to_jsonb(h)-''created_by''-''updated_by''),''[]''::jsonb) FROM %I.field_hydrants h',item.schema_name) INTO hydrants;
   results:=results||jsonb_build_array(jsonb_build_object('id',item.id,'name',item.name,'canEdit',false,'preplans',plans,'hydrants',hydrants));
 END LOOP;
 RETURN results;
END $body$;
REVOKE ALL ON FUNCTION public.department_shared_preplans(uuid,uuid) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.department_shared_preplans(uuid,uuid) TO authenticated;

CREATE FUNCTION private.department_storage_access(p_name text) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $body$
DECLARE department uuid;
BEGIN
 IF p_name !~ '^departments/[0-9a-f-]{36}/' OR NOT private.portal_server_request() THEN RETURN false; END IF;
 department:=split_part(p_name,'/',2)::uuid;
 RETURN private.department_portal_access(department) AND EXISTS(SELECT 1 FROM private.department_portals p WHERE p.department_id=department AND p.schema_name<>'firehouse');
END $body$;
REVOKE ALL ON FUNCTION private.department_storage_access(text) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION private.department_storage_access(text) TO authenticated;
CREATE POLICY department_portal_files_read ON storage.objects FOR SELECT TO authenticated USING (bucket_id='firehouse-portal' AND private.department_storage_access(name));
CREATE POLICY department_portal_files_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id='firehouse-portal' AND private.department_storage_access(name));
CREATE POLICY department_portal_files_update ON storage.objects FOR UPDATE TO authenticated USING (bucket_id='firehouse-portal' AND private.department_storage_access(name)) WITH CHECK (bucket_id='firehouse-portal' AND private.department_storage_access(name));
CREATE POLICY department_portal_files_delete ON storage.objects FOR DELETE TO authenticated USING (bucket_id='firehouse-portal' AND private.department_storage_access(name));
