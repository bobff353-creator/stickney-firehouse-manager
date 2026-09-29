BEGIN;
-- Include the existing platform owner without creating a department membership.
CREATE OR REPLACE FUNCTION firehouse.employee_account_setup() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object(
  'accounts',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',u.id,'email',u.email,
    'activated',u.email_confirmed_at IS NOT NULL AND u.last_sign_in_at IS NOT NULL AND EXISTS(SELECT 1 FROM public.portal_pin_credentials p WHERE p.user_id=u.id),
    'verified',u.email_confirmed_at IS NOT NULL,'employeeId',firehouse.employee_id_for_login(u.email)))
    FROM auth.users u WHERE (lower(btrim(u.email))='bobff353@gmail.com' OR EXISTS(SELECT 1 FROM public.department_memberships m JOIN public.departments d ON d.id=m.department_id WHERE m.user_id=u.id AND m.status='active' AND d.slug='stickney-fire-department'))), '[]'::jsonb),
  'invites',COALESCE((SELECT jsonb_agg(jsonb_build_object('email',i.email,'status',i.status,'expiresAt',i.expires_at))
    FROM public.department_invites i JOIN public.departments d ON d.id=i.department_id WHERE d.slug='stickney-fire-department'),'[]'::jsonb)
 );
$$;
REVOKE ALL ON FUNCTION firehouse.employee_account_setup() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION firehouse.link_employee_account(p_user uuid,p_employee text,p_actor text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_email text; v_existing text;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('employee-account-link',0));
  SELECT u.email INTO v_email FROM auth.users u
  WHERE u.id=p_user AND u.email_confirmed_at IS NOT NULL AND (lower(btrim(u.email))='bobff353@gmail.com' OR EXISTS(
    SELECT 1 FROM public.department_memberships m JOIN public.departments d ON d.id=m.department_id
    WHERE m.user_id=u.id AND m.status='active' AND d.slug='stickney-fire-department'));
  IF v_email IS NULL THEN RAISE EXCEPTION 'An active verified department account is required'; END IF;
  SELECT firehouse.employee_id_for_login(v_email) INTO v_existing;
  IF v_existing IS NOT NULL AND v_existing<>p_employee THEN RAISE EXCEPTION 'Account already belongs to another employee'; END IF;
  IF EXISTS(SELECT 1 FROM firehouse.employee_account_links WHERE user_id=p_user AND employee_id<>p_employee)
    OR EXISTS(SELECT 1 FROM firehouse.employee_profiles WHERE lower(btrim(email))=lower(btrim(v_email)) AND employee_id<>p_employee)
    THEN RAISE EXCEPTION 'Conflicting employee identity; review existing link first'; END IF;
  IF NOT EXISTS(SELECT 1 FROM firehouse.employees e LEFT JOIN firehouse.employee_profiles ep ON ep.employee_id=e.id
    WHERE e.id=p_employee AND e.active=1
    AND (NULLIF(ep.start_date,'') IS NULL OR ep.start_date<=to_char(now() AT TIME ZONE 'America/Chicago','YYYY-MM-DD'))
    AND (NULLIF(ep.end_date,'') IS NULL OR ep.end_date>=to_char(now() AT TIME ZONE 'America/Chicago','YYYY-MM-DD')))
    THEN RAISE EXCEPTION 'Choose a current employee'; END IF;
  INSERT INTO firehouse.employee_account_links(user_id,employee_id,linked_by) VALUES(p_user,p_employee,p_actor) ON CONFLICT(user_id) DO NOTHING;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION firehouse.link_employee_account(uuid,text,text) FROM PUBLIC,anon,authenticated;

COMMIT;
