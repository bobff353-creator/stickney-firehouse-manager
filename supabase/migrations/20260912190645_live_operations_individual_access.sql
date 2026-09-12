-- Preserve the former shared Road Closures permission before making Live Operations opt-in.
-- No employees, overrides, historical rank settings or operational records are deleted.
INSERT INTO firehouse.rank_permissions(rank,permission_key,allowed,updated_at)
SELECT rank,'road_closures.view',allowed,updated_at FROM firehouse.rank_permissions
WHERE permission_key='operations_board.view' ON CONFLICT(rank,permission_key) DO NOTHING;
INSERT INTO firehouse.employee_permission_overrides(employee_id,permission_key,effect,updated_at)
SELECT employee_id,'road_closures.view',effect,updated_at FROM firehouse.employee_permission_overrides
WHERE permission_key='operations_board.view' ON CONFLICT(employee_id,permission_key) DO NOTHING;

CREATE OR REPLACE FUNCTION private.portal_has_permission(permission text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE actor_email text; employee record; match_count int; override_effect text; saved boolean; base text[];
BEGIN
  IF NOT private.portal_server_request() OR NOT firehouse.has_department_access() THEN RETURN false; END IF;
  IF NOT permission = ANY(ARRAY['dashboard.view','operations_board.view','road_closures.view','command_center.view','daily_log.view','daily_log.manage','field_preplans.view','field_preplans.edit','field_preplans.publish','field_preplans.delete','field_preplans.review','field_preplans.manage_layers','field_preplans.manage_hazmat','field_preplans.manage_attachments','field_preplans.verify_expiring','field_preplans.manage_settings','incident_command.view','incident_command.manage','safety_inspections.view','safety_inspections.complete','safety_inspections.manage','scheduling.view','scheduling.manage','payroll.view_own','payroll.manage','employees.view','employees.manage','contacts.view','documents.view','policies.manage','box_cards.manage','inventory.view','inventory.check','inventory.repairs.manage','inventory.setup.manage','settings.manage','permissions.manage']) THEN RETURN false; END IF;
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
  -- Board access is opt-in per member; old rank grants are retained but ignored.
  IF permission='operations_board.view' THEN RETURN false; END IF;
  SELECT allowed=1 INTO saved FROM firehouse.rank_permissions WHERE rank=employee.rank AND permission_key=permission;
  IF FOUND THEN RETURN saved; END IF;
  IF lower(employee.rank) LIKE '%chief%' THEN base:=ARRAY['dashboard.view','road_closures.view','command_center.view','daily_log.view','daily_log.manage','field_preplans.view','field_preplans.edit','field_preplans.publish','field_preplans.delete','field_preplans.review','field_preplans.manage_layers','field_preplans.manage_hazmat','field_preplans.manage_attachments','field_preplans.verify_expiring','field_preplans.manage_settings','incident_command.view','incident_command.manage','safety_inspections.view','safety_inspections.complete','safety_inspections.manage','scheduling.view','scheduling.manage','payroll.view_own','payroll.manage','employees.view','employees.manage','contacts.view','documents.view','policies.manage','box_cards.manage','inventory.view','inventory.check','inventory.repairs.manage','inventory.setup.manage','settings.manage','permissions.manage'];
  ELSIF lower(employee.rank) LIKE '%captain%' OR lower(employee.rank) LIKE '%lieutenant%' THEN base:=ARRAY['dashboard.view','road_closures.view','scheduling.view','payroll.view_own','documents.view','field_preplans.view','safety_inspections.view','safety_inspections.complete','inventory.view','inventory.check','daily_log.view','daily_log.manage','field_preplans.edit','incident_command.view','field_preplans.review','field_preplans.verify_expiring','employees.view','contacts.view','incident_command.manage','safety_inspections.manage','inventory.repairs.manage','command_center.view','scheduling.manage'];
  ELSIF lower(employee.rank) LIKE '%firefighter%' OR lower(btrim(employee.rank))='ff' THEN base:=ARRAY['dashboard.view','road_closures.view','scheduling.view','payroll.view_own','documents.view','field_preplans.view','safety_inspections.view','safety_inspections.complete','inventory.view','inventory.check','daily_log.view','daily_log.manage','field_preplans.edit','incident_command.view'];
  ELSE base:=ARRAY['dashboard.view','road_closures.view','scheduling.view','payroll.view_own','documents.view','field_preplans.view','safety_inspections.view','safety_inspections.complete','inventory.view','inventory.check']; END IF;
  RETURN permission=ANY(base);
END $$;
REVOKE ALL ON FUNCTION private.portal_has_permission(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.portal_has_permission(text) TO authenticated;

-- This is a real authorization-policy change, even on an installation with no saved rows.
-- The policy and revision commit atomically. Normal no-op saves remain revision-stable.
UPDATE firehouse.system_meta SET value=gen_random_uuid()::text,updated_at=now()::text
WHERE key='permissions-revision';
