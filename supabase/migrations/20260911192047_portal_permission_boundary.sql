-- Coordinated cutover: deploy the server-header-capable application first.
-- No records or existing employee overrides are removed by this migration.
CREATE OR REPLACE FUNCTION private.portal_server_request()
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT (SELECT auth.uid()) IS NOT NULL AND
    COALESCE(encode(extensions.digest(btrim(NULLIF(current_setting('request.headers',true),'')::jsonb->>'x-firehouse-server-key'),'sha256'),'hex') = '4f50aa6cea4730aa34556b2ecebe8d7a0b5fc03dc1cfcb7fe4557666da97e6c2',false)
$$;
REVOKE ALL ON FUNCTION private.portal_server_request() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.portal_server_request() TO authenticated;

CREATE OR REPLACE FUNCTION firehouse.execute_portal_sql(p_sql text, p_mode text DEFAULT 'all'::text, p_secret text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'firehouse', 'extensions', 'pg_temp'
AS $function$
DECLARE
  result jsonb;
  affected bigint;
BEGIN
  IF NOT private.portal_server_request() THEN
    RAISE EXCEPTION 'Use the authenticated portal API' USING ERRCODE = '42501';
  END IF;
  IF NOT firehouse.has_department_access() THEN
    RAISE EXCEPTION 'Stickney department access required' USING ERRCODE = '42501';
  END IF;
  IF p_sql IS NULL OR length(p_sql) > 200000 OR p_sql ~ '(;|--|/\*|\*/)' THEN
    RAISE EXCEPTION 'Unsafe portal query';
  END IF;
  IF p_sql ~* '\m(public|auth|storage|extensions|vault|realtime|graphql)\s*\.' THEN
    RAISE EXCEPTION 'Cross-schema portal query denied';
  END IF;
  IF p_sql !~* '^\s*(select|insert|update|delete|with)\M'
     OR p_sql ~* '\m(create|alter|drop|truncate|grant|revoke|copy|call|show|reset|listen|notify|vacuum|analyze)\M' THEN
    RAISE EXCEPTION 'Unsupported portal query';
  END IF;

  IF p_mode = 'all' THEN
    EXECUTE 'SELECT COALESCE(jsonb_agg(to_jsonb(portal_row)), ''[]''::jsonb) FROM (' || p_sql || ') AS portal_row' INTO result;
    RETURN COALESCE(result, '[]'::jsonb);
  ELSIF p_mode = 'first' THEN
    EXECUTE 'SELECT to_jsonb(portal_row) FROM (' || p_sql || ') AS portal_row LIMIT 1' INTO result;
    RETURN result;
  ELSIF p_mode = 'run' THEN
    EXECUTE p_sql;
    GET DIAGNOSTICS affected = ROW_COUNT;
    RETURN jsonb_build_object('success', true, 'meta', jsonb_build_object('changes', affected));
  END IF;
  RAISE EXCEPTION 'Unknown portal query mode';
END;
$function$;


-- The arbitrary-SQL executor is now server-proof + authenticated department only.
REVOKE ALL ON ALL TABLES IN SCHEMA firehouse FROM PUBLIC,anon,authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA firehouse FROM PUBLIC,anon,authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA firehouse REVOKE ALL ON TABLES FROM PUBLIC,anon,authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA firehouse REVOKE ALL ON SEQUENCES FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION firehouse.execute_portal_sql(text,text,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.firehouse_sql(text,text,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.firehouse_sql_batch(jsonb,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION firehouse.execute_portal_sql(text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.firehouse_sql(text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.firehouse_sql_batch(jsonb,text) TO authenticated;

-- Internal lookup only. Defaults mirror app/permissions.ts and are parity-tested.
CREATE OR REPLACE FUNCTION private.portal_has_permission(permission text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE actor_email text; employee record; match_count int; override_effect text; saved boolean; base text[];
BEGIN
  IF NOT private.portal_server_request() OR NOT firehouse.has_department_access() THEN RETURN false; END IF;
  IF NOT permission = ANY(ARRAY['dashboard.view','operations_board.view','command_center.view','daily_log.view','daily_log.manage','field_preplans.view','field_preplans.edit','field_preplans.publish','field_preplans.delete','field_preplans.review','field_preplans.manage_layers','field_preplans.manage_hazmat','field_preplans.manage_attachments','field_preplans.verify_expiring','field_preplans.manage_settings','incident_command.view','incident_command.manage','safety_inspections.view','safety_inspections.complete','safety_inspections.manage','scheduling.view','scheduling.manage','payroll.view_own','payroll.manage','employees.view','employees.manage','contacts.view','documents.view','policies.manage','box_cards.manage','inventory.view','inventory.check','inventory.repairs.manage','inventory.setup.manage','settings.manage','permissions.manage']) THEN RETURN false; END IF;
  SELECT lower(btrim(email)) INTO actor_email FROM auth.users WHERE id=(SELECT auth.uid());
  IF actor_email='bobff353@gmail.com' THEN RETURN true; END IF;
  SELECT count(*) INTO match_count FROM firehouse.employees e JOIN firehouse.employee_profiles ep ON ep.employee_id=e.id
    WHERE e.active=1 AND lower(btrim(ep.email))=actor_email;
  IF match_count<>1 THEN RETURN false; END IF;
  SELECT e.id,p.label rank,COALESCE(ep.is_admin,0) is_admin,ep.end_date INTO employee
    FROM firehouse.employees e JOIN firehouse.pay_scales p ON p.id=e.pay_scale_id JOIN firehouse.employee_profiles ep ON ep.employee_id=e.id
    WHERE e.active=1 AND lower(btrim(ep.email))=actor_email;
  IF employee.end_date IS NOT NULL AND employee.end_date<>'' AND employee.end_date<to_char(now() AT TIME ZONE 'America/Chicago','YYYY-MM-DD') THEN RETURN false; END IF;
  IF permission='payroll.view_own' THEN RETURN true; END IF;
  SELECT effect INTO override_effect FROM firehouse.employee_permission_overrides WHERE employee_id=employee.id AND permission_key=permission;
  IF override_effect='deny' THEN RETURN false; END IF;
  IF override_effect='allow' THEN RETURN true; END IF;
  IF employee.is_admin=1 THEN RETURN true; END IF;
  SELECT allowed=1 INTO saved FROM firehouse.rank_permissions WHERE rank=employee.rank AND permission_key=permission;
  IF FOUND THEN RETURN saved; END IF;
  IF lower(employee.rank) LIKE '%chief%' THEN base:=ARRAY['dashboard.view','operations_board.view','command_center.view','daily_log.view','daily_log.manage','field_preplans.view','field_preplans.edit','field_preplans.publish','field_preplans.delete','field_preplans.review','field_preplans.manage_layers','field_preplans.manage_hazmat','field_preplans.manage_attachments','field_preplans.verify_expiring','field_preplans.manage_settings','incident_command.view','incident_command.manage','safety_inspections.view','safety_inspections.complete','safety_inspections.manage','scheduling.view','scheduling.manage','payroll.view_own','payroll.manage','employees.view','employees.manage','contacts.view','documents.view','policies.manage','box_cards.manage','inventory.view','inventory.check','inventory.repairs.manage','inventory.setup.manage','settings.manage','permissions.manage'];
  ELSIF lower(employee.rank) LIKE '%captain%' OR lower(employee.rank) LIKE '%lieutenant%' THEN base:=ARRAY['dashboard.view','operations_board.view','scheduling.view','payroll.view_own','documents.view','field_preplans.view','safety_inspections.view','safety_inspections.complete','inventory.view','inventory.check','daily_log.view','daily_log.manage','field_preplans.edit','incident_command.view','field_preplans.review','field_preplans.verify_expiring','employees.view','contacts.view','incident_command.manage','safety_inspections.manage','inventory.repairs.manage','command_center.view','scheduling.manage'];
  ELSIF lower(employee.rank) LIKE '%firefighter%' OR lower(btrim(employee.rank))='ff' THEN base:=ARRAY['dashboard.view','operations_board.view','scheduling.view','payroll.view_own','documents.view','field_preplans.view','safety_inspections.view','safety_inspections.complete','inventory.view','inventory.check','daily_log.view','daily_log.manage','field_preplans.edit','incident_command.view'];
  ELSE base:=ARRAY['dashboard.view','operations_board.view','scheduling.view','payroll.view_own','documents.view','field_preplans.view','safety_inspections.view','safety_inspections.complete','inventory.view','inventory.check']; END IF;
  RETURN permission=ANY(base);
END $$;
REVOKE ALL ON FUNCTION private.portal_has_permission(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.portal_has_permission(text) TO authenticated;

CREATE OR REPLACE FUNCTION private.inventory_can_access(target_department_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT CASE WHEN target_department_id='14a76771-4c24-481b-8def-e6cce005c17b'::uuid THEN (private.portal_has_permission('inventory.view') OR private.portal_has_permission('operations_board.view') OR private.portal_has_permission('daily_log.view') OR private.portal_has_permission('documents.view'))
 ELSE (public.is_platform_owner()
    or exists (
      select 1
      from public.department_memberships as membership
      where membership.department_id = target_department_id
        and membership.user_id = (select auth.uid())
        and membership.status = 'active'
    )) END
$$;
REVOKE ALL ON FUNCTION private.inventory_can_access(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.inventory_can_access(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION private.inventory_can_write(target_department_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT CASE WHEN target_department_id='14a76771-4c24-481b-8def-e6cce005c17b'::uuid THEN (private.portal_has_permission('inventory.check') OR private.portal_has_permission('inventory.repairs.manage') OR private.portal_has_permission('inventory.setup.manage'))
 ELSE (public.is_platform_owner()
    or exists (
      select 1
      from public.department_memberships as membership
      where membership.department_id = target_department_id
        and membership.user_id = (select auth.uid())
        and membership.status = 'active'
        and membership.role in ('admin', 'chief', 'inspector', 'user')
    )) END
$$;
REVOKE ALL ON FUNCTION private.inventory_can_write(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.inventory_can_write(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION private.inventory_can_admin(target_department_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT CASE WHEN target_department_id='14a76771-4c24-481b-8def-e6cce005c17b'::uuid THEN private.portal_has_permission('inventory.setup.manage')
 ELSE (public.is_platform_owner()
    or exists (
      select 1
      from public.department_memberships as membership
      where membership.department_id = target_department_id
        and membership.user_id = (select auth.uid())
        and membership.status = 'active'
        and membership.role in ('admin', 'chief')
    )) END
$$;
REVOKE ALL ON FUNCTION private.inventory_can_admin(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.inventory_can_admin(uuid) TO authenticated;

CREATE POLICY portal_server_boundary ON public.department_apparatus AS RESTRICTIVE FOR ALL TO authenticated
 USING (department_id<>'14a76771-4c24-481b-8def-e6cce005c17b'::uuid OR (SELECT private.portal_server_request()))
 WITH CHECK (department_id<>'14a76771-4c24-481b-8def-e6cce005c17b'::uuid OR (SELECT private.portal_server_request()));

CREATE POLICY portal_server_boundary ON public.inventory_compartments AS RESTRICTIVE FOR ALL TO authenticated
 USING (department_id<>'14a76771-4c24-481b-8def-e6cce005c17b'::uuid OR (SELECT private.portal_server_request()))
 WITH CHECK (department_id<>'14a76771-4c24-481b-8def-e6cce005c17b'::uuid OR (SELECT private.portal_server_request()));

CREATE POLICY portal_server_boundary ON public.inventory_stock_items AS RESTRICTIVE FOR ALL TO authenticated
 USING (department_id<>'14a76771-4c24-481b-8def-e6cce005c17b'::uuid OR (SELECT private.portal_server_request()))
 WITH CHECK (department_id<>'14a76771-4c24-481b-8def-e6cce005c17b'::uuid OR (SELECT private.portal_server_request()));

CREATE POLICY portal_server_boundary ON public.inventory_stock_lots AS RESTRICTIVE FOR ALL TO authenticated
 USING (department_id<>'14a76771-4c24-481b-8def-e6cce005c17b'::uuid OR (SELECT private.portal_server_request()))
 WITH CHECK (department_id<>'14a76771-4c24-481b-8def-e6cce005c17b'::uuid OR (SELECT private.portal_server_request()));

CREATE POLICY portal_server_boundary ON public.inventory_transactions AS RESTRICTIVE FOR ALL TO authenticated
 USING (department_id<>'14a76771-4c24-481b-8def-e6cce005c17b'::uuid OR (SELECT private.portal_server_request()))
 WITH CHECK (department_id<>'14a76771-4c24-481b-8def-e6cce005c17b'::uuid OR (SELECT private.portal_server_request()));

CREATE POLICY portal_server_boundary ON public.inventory_photo_views AS RESTRICTIVE FOR ALL TO authenticated
 USING (department_id<>'14a76771-4c24-481b-8def-e6cce005c17b'::uuid OR (SELECT private.portal_server_request()))
 WITH CHECK (department_id<>'14a76771-4c24-481b-8def-e6cce005c17b'::uuid OR (SELECT private.portal_server_request()));

CREATE POLICY portal_server_boundary ON public.inventory_photo_hotspots AS RESTRICTIVE FOR ALL TO authenticated
 USING (department_id<>'14a76771-4c24-481b-8def-e6cce005c17b'::uuid OR (SELECT private.portal_server_request()))
 WITH CHECK (department_id<>'14a76771-4c24-481b-8def-e6cce005c17b'::uuid OR (SELECT private.portal_server_request()));

CREATE POLICY portal_server_boundary ON public.inventory_audit_events AS RESTRICTIVE FOR ALL TO authenticated
 USING (department_id<>'14a76771-4c24-481b-8def-e6cce005c17b'::uuid OR (SELECT private.portal_server_request()))
 WITH CHECK (department_id<>'14a76771-4c24-481b-8def-e6cce005c17b'::uuid OR (SELECT private.portal_server_request()));

CREATE POLICY portal_server_boundary ON public.inventory_apparatus_profiles AS RESTRICTIVE FOR ALL TO authenticated
 USING (department_id<>'14a76771-4c24-481b-8def-e6cce005c17b'::uuid OR (SELECT private.portal_server_request()))
 WITH CHECK (department_id<>'14a76771-4c24-481b-8def-e6cce005c17b'::uuid OR (SELECT private.portal_server_request()));

CREATE POLICY portal_server_boundary ON public.inventory_check_items AS RESTRICTIVE FOR ALL TO authenticated
 USING (department_id<>'14a76771-4c24-481b-8def-e6cce005c17b'::uuid OR (SELECT private.portal_server_request()))
 WITH CHECK (department_id<>'14a76771-4c24-481b-8def-e6cce005c17b'::uuid OR (SELECT private.portal_server_request()));

CREATE POLICY portal_server_boundary ON public.inventory_readiness_exceptions AS RESTRICTIVE FOR ALL TO authenticated
 USING (department_id<>'14a76771-4c24-481b-8def-e6cce005c17b'::uuid OR (SELECT private.portal_server_request()))
 WITH CHECK (department_id<>'14a76771-4c24-481b-8def-e6cce005c17b'::uuid OR (SELECT private.portal_server_request()));

CREATE POLICY portal_server_boundary ON public.inventory_deficiency_photos AS RESTRICTIVE FOR ALL TO authenticated
 USING (department_id<>'14a76771-4c24-481b-8def-e6cce005c17b'::uuid OR (SELECT private.portal_server_request()))
 WITH CHECK (department_id<>'14a76771-4c24-481b-8def-e6cce005c17b'::uuid OR (SELECT private.portal_server_request()));

CREATE POLICY portal_server_boundary ON public.inventory_checks AS RESTRICTIVE FOR ALL TO authenticated
 USING (department_id<>'14a76771-4c24-481b-8def-e6cce005c17b'::uuid OR (SELECT private.portal_server_request()))
 WITH CHECK (department_id<>'14a76771-4c24-481b-8def-e6cce005c17b'::uuid OR (SELECT private.portal_server_request()));

CREATE POLICY portal_server_boundary ON public.inventory_location_change_requests AS RESTRICTIVE FOR ALL TO authenticated
 USING (department_id<>'14a76771-4c24-481b-8def-e6cce005c17b'::uuid OR (SELECT private.portal_server_request()))
 WITH CHECK (department_id<>'14a76771-4c24-481b-8def-e6cce005c17b'::uuid OR (SELECT private.portal_server_request()));

CREATE POLICY portal_server_boundary ON public.inventory_equipment AS RESTRICTIVE FOR ALL TO authenticated
 USING (department_id<>'14a76771-4c24-481b-8def-e6cce005c17b'::uuid OR (SELECT private.portal_server_request()))
 WITH CHECK (department_id<>'14a76771-4c24-481b-8def-e6cce005c17b'::uuid OR (SELECT private.portal_server_request()));

CREATE POLICY portal_server_boundary ON public.inventory_work_orders AS RESTRICTIVE FOR ALL TO authenticated
 USING (department_id<>'14a76771-4c24-481b-8def-e6cce005c17b'::uuid OR (SELECT private.portal_server_request()))
 WITH CHECK (department_id<>'14a76771-4c24-481b-8def-e6cce005c17b'::uuid OR (SELECT private.portal_server_request()));

CREATE POLICY portal_server_boundary ON public.inventory_work_order_documents AS RESTRICTIVE FOR ALL TO authenticated
 USING (department_id<>'14a76771-4c24-481b-8def-e6cce005c17b'::uuid OR (SELECT private.portal_server_request()))
 WITH CHECK (department_id<>'14a76771-4c24-481b-8def-e6cce005c17b'::uuid OR (SELECT private.portal_server_request()));

CREATE POLICY portal_server_boundary ON public.inventory_inspection_schedules AS RESTRICTIVE FOR ALL TO authenticated
 USING (department_id<>'14a76771-4c24-481b-8def-e6cce005c17b'::uuid OR (SELECT private.portal_server_request()))
 WITH CHECK (department_id<>'14a76771-4c24-481b-8def-e6cce005c17b'::uuid OR (SELECT private.portal_server_request()));

CREATE POLICY portal_server_boundary ON public.inventory_scba_templates AS RESTRICTIVE FOR ALL TO authenticated
 USING (department_id<>'14a76771-4c24-481b-8def-e6cce005c17b'::uuid OR (SELECT private.portal_server_request()))
 WITH CHECK (department_id<>'14a76771-4c24-481b-8def-e6cce005c17b'::uuid OR (SELECT private.portal_server_request()));

CREATE POLICY portal_server_boundary ON public.inventory_scba_check_entries AS RESTRICTIVE FOR ALL TO authenticated
 USING (department_id<>'14a76771-4c24-481b-8def-e6cce005c17b'::uuid OR (SELECT private.portal_server_request()))
 WITH CHECK (department_id<>'14a76771-4c24-481b-8def-e6cce005c17b'::uuid OR (SELECT private.portal_server_request()));

CREATE POLICY portal_storage_boundary ON storage.objects AS RESTRICTIVE FOR ALL TO authenticated
 USING (bucket_id NOT IN ('firehouse-portal','stickney-inventory-media') OR (SELECT private.portal_server_request()))
 WITH CHECK (bucket_id NOT IN ('firehouse-portal','stickney-inventory-media') OR (SELECT private.portal_server_request()));

-- Delegated setup access also applies to the fleet identity row; other tenants unchanged.
CREATE POLICY portal_invite_boundary ON public.department_invites AS RESTRICTIVE FOR ALL TO authenticated
 USING (department_id<>'14a76771-4c24-481b-8def-e6cce005c17b'::uuid OR private.portal_has_permission('employees.manage'))
 WITH CHECK (department_id<>'14a76771-4c24-481b-8def-e6cce005c17b'::uuid OR private.portal_has_permission('employees.manage'));
CREATE POLICY portal_employee_invites ON public.department_invites FOR ALL TO authenticated
 USING (department_id='14a76771-4c24-481b-8def-e6cce005c17b'::uuid AND private.portal_has_permission('employees.manage'))
 WITH CHECK (department_id='14a76771-4c24-481b-8def-e6cce005c17b'::uuid AND private.portal_has_permission('employees.manage'));

CREATE POLICY portal_apparatus_setup ON public.department_apparatus FOR ALL TO authenticated
 USING (department_id='14a76771-4c24-481b-8def-e6cce005c17b'::uuid AND private.portal_has_permission('inventory.setup.manage'))
 WITH CHECK (department_id='14a76771-4c24-481b-8def-e6cce005c17b'::uuid AND private.portal_has_permission('inventory.setup.manage'));

INSERT INTO firehouse.system_meta(key,value,updated_at) VALUES('permissions-revision',gen_random_uuid()::text,now()::text)
 ON CONFLICT(key) DO NOTHING;
CREATE OR REPLACE FUNCTION firehouse.bump_permissions_revision()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
 IF TG_OP='UPDATE' THEN
   CASE TG_TABLE_NAME
     WHEN 'rank_permissions' THEN IF NEW.allowed IS NOT DISTINCT FROM OLD.allowed THEN RETURN NULL; END IF;
     WHEN 'employee_permission_overrides' THEN IF NEW.effect IS NOT DISTINCT FROM OLD.effect THEN RETURN NULL; END IF;
     WHEN 'employee_profiles' THEN IF ROW(NEW.email,NEW.is_admin,NEW.employee_number,NEW.end_date) IS NOT DISTINCT FROM ROW(OLD.email,OLD.is_admin,OLD.employee_number,OLD.end_date) THEN RETURN NULL; END IF;
     WHEN 'employees' THEN IF ROW(NEW.active,NEW.pay_scale_id) IS NOT DISTINCT FROM ROW(OLD.active,OLD.pay_scale_id) THEN RETURN NULL; END IF;
     WHEN 'pay_scales' THEN IF NEW.label IS NOT DISTINCT FROM OLD.label THEN RETURN NULL; END IF;
   END CASE;
 END IF;
 UPDATE firehouse.system_meta SET value=gen_random_uuid()::text,updated_at=now()::text WHERE key='permissions-revision';
 RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION firehouse.bump_permissions_revision() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER permissions_revision AFTER INSERT OR UPDATE OR DELETE ON firehouse.rank_permissions
 FOR EACH ROW EXECUTE FUNCTION firehouse.bump_permissions_revision();
CREATE TRIGGER permissions_revision AFTER INSERT OR UPDATE OR DELETE ON firehouse.employee_permission_overrides
 FOR EACH ROW EXECUTE FUNCTION firehouse.bump_permissions_revision();
CREATE TRIGGER permissions_revision AFTER INSERT OR UPDATE OR DELETE ON firehouse.employee_profiles
 FOR EACH ROW EXECUTE FUNCTION firehouse.bump_permissions_revision();
CREATE TRIGGER permissions_revision AFTER INSERT OR UPDATE OR DELETE ON firehouse.employees
 FOR EACH ROW EXECUTE FUNCTION firehouse.bump_permissions_revision();
CREATE TRIGGER permissions_revision AFTER INSERT OR UPDATE OR DELETE ON firehouse.pay_scales
 FOR EACH ROW EXECUTE FUNCTION firehouse.bump_permissions_revision();
