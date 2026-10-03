CREATE FUNCTION private.department_shared_snapshot(p_viewer uuid,p_source uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $body$
DECLARE item record; plans jsonb; hydrants jsonb; results jsonb:='[]';
BEGIN
 FOR item IN SELECT d.id,d.name,p.schema_name FROM public.departments d JOIN private.department_portals p ON p.department_id=d.id WHERE d.id<>p_viewer AND (p_source IS NULL OR d.id=p_source) ORDER BY d.name LOOP
   EXECUTE format($sql$SELECT coalesce(jsonb_agg((to_jsonb(p)-'created_by'-'updated_by'-'draft_owner'-'published_by'-'archived_by') || jsonb_build_object(
   'features',(SELECT coalesce(jsonb_agg(to_jsonb(f)-'created_by'-'updated_by'-'verified_by'),'[]'::jsonb) FROM %1$I.field_preplan_features f WHERE f.preplan_id=p.id),
   'levels',(SELECT coalesce(jsonb_agg(to_jsonb(f)-'created_by'-'updated_by'),'[]'::jsonb) FROM %1$I.field_preplan_levels f WHERE f.preplan_id=p.id AND f.hidden=0 AND f.archived=0),
   'hazmat',(SELECT coalesce(jsonb_agg(to_jsonb(f)-'created_by'-'updated_by'),'[]'::jsonb) FROM %1$I.field_preplan_hazmat f WHERE f.preplan_id=p.id),
   'photos',(SELECT coalesce(jsonb_agg(to_jsonb(f)-'created_by'-'object_key'),'[]'::jsonb) FROM %1$I.field_preplan_photos f WHERE f.preplan_id=p.id),
   'assets',(SELECT coalesce(jsonb_agg(to_jsonb(f)-'created_by'-'updated_by'-'object_key'),'[]'::jsonb) FROM %1$I.field_preplan_assets f WHERE f.preplan_id=p.id AND f.archived=0)
   )),'[]'::jsonb) FROM %1$I.field_preplans p WHERE p.publication_status='published'$sql$,item.schema_name) INTO plans;
   EXECUTE format('SELECT coalesce(jsonb_agg(to_jsonb(h)-''created_by''-''updated_by''),''[]''::jsonb) FROM %I.field_hydrants h',item.schema_name) INTO hydrants;
   results:=results||jsonb_build_array(jsonb_build_object('id',item.id,'name',item.name,'canEdit',false,'preplans',plans,'hydrants',hydrants));
 END LOOP;
 RETURN results;
END $body$;
REVOKE ALL ON FUNCTION private.department_shared_snapshot(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION department_gateway.department_shared_preplans(p_viewer uuid,p_source uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $body$
BEGIN
 IF NOT private.portal_server_request() OR NOT private.department_portal_access(p_viewer) THEN RAISE EXCEPTION 'Verified department access required' USING ERRCODE='42501'; END IF;
 RETURN private.department_shared_snapshot(p_viewer,p_source);
END $body$;

CREATE FUNCTION department_gateway.department_shared_preplan_file(p_viewer uuid,p_source uuid,p_file text,p_kind text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $body$
DECLARE target name; result jsonb;
BEGIN
 IF NOT private.portal_server_request() OR NOT private.department_portal_access(p_viewer) THEN RAISE EXCEPTION 'Verified department access required' USING ERRCODE='42501'; END IF;
 SELECT schema_name INTO target FROM private.department_portals WHERE department_id=p_source;
 IF target IS NULL THEN RETURN NULL; END IF;
 IF p_kind='photo' THEN
   EXECUTE format('SELECT jsonb_build_object(''objectKey'',f.object_key,''mimeType'',f.content_type,''filename'',f.filename) FROM %I.field_preplan_photos f JOIN %I.field_preplans p ON p.id=f.preplan_id WHERE p.publication_status=''published'' AND f.id=$1',target,target) INTO result USING p_file;
 ELSIF p_kind='asset' THEN
   EXECUTE format('SELECT jsonb_build_object(''objectKey'',f.object_key,''mimeType'',f.mime_type,''filename'',f.original_filename) FROM %I.field_preplan_assets f JOIN %I.field_preplans p ON p.id=f.preplan_id WHERE p.publication_status=''published'' AND f.archived=0 AND f.id=$1',target,target) INTO result USING p_file;
 ELSE RETURN NULL; END IF;
 IF result IS NOT NULL AND target<>'firehouse' THEN result:=jsonb_set(result,'{objectKey}',to_jsonb('departments/'||p_source::text||'/'||(result->>'objectKey'))); END IF;
 RETURN result;
END $body$;
REVOKE ALL ON FUNCTION department_gateway.department_shared_preplan_file(uuid,uuid,text,text) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION department_gateway.department_shared_preplan_file(uuid,uuid,text,text) TO authenticated;
CREATE FUNCTION public.department_shared_preplan_file(p_viewer uuid,p_source uuid,p_file text,p_kind text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $body$ SELECT department_gateway.department_shared_preplan_file(p_viewer,p_source,p_file,p_kind); $body$;
REVOKE ALL ON FUNCTION public.department_shared_preplan_file(uuid,uuid,text,text) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.department_shared_preplan_file(uuid,uuid,text,text) TO authenticated;

-- Empty, generic rank forms make a new account usable. Rates remain zero until
-- its administrator supplies the department's actual rates. No source rows.
CREATE FUNCTION private.initialize_department_forms() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $body$
DECLARE target name;
BEGIN
 SELECT schema_name INTO target FROM private.department_portals WHERE department_id=NEW.id AND schema_name<>'firehouse';
 IF target IS NULL THEN RETURN NEW; END IF;
 EXECUTE format('INSERT INTO %I.pay_scales(id,label,regular_rate,overtime_rate,holiday_rate,sort_order) VALUES (''chief'',''Chief'',0,0,0,1),(''deputy-chief'',''Deputy Chief'',0,0,0,2),(''captain'',''Captain'',0,0,0,3),(''lieutenant'',''Lieutenant'',0,0,0,4),(''firefighter'',''Firefighter'',0,0,0,5) ON CONFLICT DO NOTHING',target);
 RETURN NEW;
END $body$;
REVOKE ALL ON FUNCTION private.initialize_department_forms() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER zz_initialize_department_forms AFTER INSERT ON public.departments FOR EACH ROW EXECUTE FUNCTION private.initialize_department_forms();
CREATE TRIGGER zz_backfill_department_forms AFTER UPDATE ON public.departments FOR EACH ROW EXECUTE FUNCTION private.initialize_department_forms();
UPDATE public.departments SET name=name WHERE id IN (SELECT department_id FROM private.department_portals WHERE schema_name<>'firehouse');
DROP TRIGGER zz_backfill_department_forms ON public.departments;
NOTIFY pgrst,'reload schema';
