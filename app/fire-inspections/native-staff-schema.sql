-- Inspection-specific grants for EXISTING verified Firehouse Manager accounts.
-- This adds no portal accounts, invitations, emails, or active staff grants.
CREATE TABLE firehouse.fire_inspection_staff_workspaces (
 department_id text PRIMARY KEY,owner_user_id text NOT NULL,owner_email text NOT NULL,
 rollout_enabled boolean NOT NULL DEFAULT false,revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
 created_at text NOT NULL,updated_at text NOT NULL
);
CREATE TABLE firehouse.fire_inspection_staff_members (
 department_id text NOT NULL,id text NOT NULL,email text NOT NULL CHECK(email=lower(btrim(email))),display_name text NOT NULL,
 role text NOT NULL CHECK(role IN('admin','supervisor','inspector','viewer')),
 status text NOT NULL CHECK(status IN('draft','invited','active','disabled')),user_id text,employee_id text,
 revision integer NOT NULL DEFAULT 1 CHECK(revision>0),last_mutation_id text NOT NULL,
 created_at text NOT NULL,updated_at text NOT NULL,created_by text NOT NULL,
 PRIMARY KEY(department_id,id),UNIQUE(department_id,email),
 FOREIGN KEY(department_id) REFERENCES firehouse.fire_inspection_staff_workspaces(department_id)
);
CREATE UNIQUE INDEX fire_inspection_staff_user_binding ON firehouse.fire_inspection_staff_members(department_id,user_id) WHERE user_id IS NOT NULL;
CREATE TABLE firehouse.fire_inspection_staff_mutations (
 department_id text NOT NULL,request_id text NOT NULL,request_hash text NOT NULL,actor_user_id text NOT NULL,
 member_id text NOT NULL,response_json text NOT NULL,created_at text NOT NULL,PRIMARY KEY(department_id,request_id)
);
CREATE TABLE firehouse.fire_inspection_staff_audit (
 department_id text NOT NULL,id text NOT NULL,actor_user_id text NOT NULL,actor_email text NOT NULL,
 action text NOT NULL,member_id text NOT NULL,before_json text,after_json text NOT NULL,reason text NOT NULL,
 request_id text NOT NULL,request_hash text NOT NULL,created_at text NOT NULL,
 PRIMARY KEY(department_id,id),UNIQUE(department_id,request_id,action)
);
ALTER TABLE firehouse.fire_inspection_staff_workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE firehouse.fire_inspection_staff_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE firehouse.fire_inspection_staff_mutations ENABLE ROW LEVEL SECURITY;
ALTER TABLE firehouse.fire_inspection_staff_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON firehouse.fire_inspection_staff_workspaces,firehouse.fire_inspection_staff_members,firehouse.fire_inspection_staff_mutations,firehouse.fire_inspection_staff_audit FROM PUBLIC,anon,authenticated;

-- Prepared ACL helpers only. Existing pilot policies deliberately remain intact.
CREATE OR REPLACE FUNCTION private.fire_inspection_staff_allowed(p_department text,p_permission text DEFAULT 'records.read') RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT private.portal_server_request() AND firehouse.has_department_access()
 AND EXISTS(SELECT 1 FROM public.current_department_ids() AS d WHERE d::text=p_department)
 AND EXISTS(SELECT 1 FROM firehouse.fire_inspection_staff_workspaces w WHERE w.department_id=p_department AND
  (w.owner_user_id=(SELECT auth.uid())::text OR (w.rollout_enabled AND EXISTS(
   SELECT 1 FROM firehouse.fire_inspection_staff_members m WHERE m.department_id=p_department AND m.user_id=(SELECT auth.uid())::text AND m.status='active'
   AND (p_permission='records.read' OR m.role='admin'
    OR m.role IN('supervisor','inspector') AND p_permission IN('evidence.write','inspections.write','inspections.issue','staff.read')
    OR m.role='supervisor' AND p_permission IN('inspections.assign','templates.approve','citations.approve','corrections.review','reports.amend','reports.void','audit.read'))))))
$$;
REVOKE ALL ON FUNCTION private.fire_inspection_staff_allowed(text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.fire_inspection_staff_allowed(text,text) TO authenticated;

CREATE OR REPLACE FUNCTION private.fire_inspection_staff_case_allowed(p_department text,p_record text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT private.fire_inspection_staff_allowed(p_department,'evidence.write') AND EXISTS(
 SELECT 1 FROM firehouse.fire_inspection_staff_workspaces w JOIN firehouse.fire_inspection_pilot_records r ON r.department_id=w.department_id
 WHERE w.department_id=p_department AND r.id=p_record AND r.archived=0 AND (
 w.owner_user_id=(SELECT auth.uid())::text OR EXISTS(SELECT 1 FROM firehouse.fire_inspection_staff_members m
 WHERE m.department_id=p_department AND m.user_id=(SELECT auth.uid())::text AND m.status='active' AND (
 m.role IN('admin','supervisor') OR m.role='inspector' AND m.employee_id IS NOT NULL
 AND EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(r.payload::jsonb->'team'->'assignees','[]'::jsonb)) a WHERE a->>'id'=m.employee_id)))))
$$;
REVOKE ALL ON FUNCTION private.fire_inspection_staff_case_allowed(text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.fire_inspection_staff_case_allowed(text,text) TO authenticated;
