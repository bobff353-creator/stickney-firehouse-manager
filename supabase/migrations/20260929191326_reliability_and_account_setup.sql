BEGIN;
CREATE TABLE firehouse.background_job_runs (
  id text PRIMARY KEY, job_name text NOT NULL,
  status text NOT NULL CHECK(status IN ('running','succeeded','failed')),
  started_at timestamptz NOT NULL, finished_at timestamptz, summary text
);
CREATE INDEX background_job_runs_latest ON firehouse.background_job_runs(job_name,started_at DESC);
ALTER TABLE firehouse.background_job_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON firehouse.background_job_runs FROM PUBLIC,anon,authenticated;

CREATE TABLE firehouse.employee_account_links (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id),
  employee_id text NOT NULL REFERENCES firehouse.employees(id),
  linked_at timestamptz NOT NULL DEFAULT now(), linked_by text NOT NULL
);
CREATE INDEX employee_account_links_employee ON firehouse.employee_account_links(employee_id);
ALTER TABLE firehouse.employee_account_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON firehouse.employee_account_links FROM PUBLIC,anon,authenticated;

-- A verified account can have one personnel identity. Ambiguity fails closed.
-- Several verified logins may deliberately belong to one employee (work/personal).
CREATE FUNCTION firehouse.employee_id_for_login(p_email text) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  WITH matches AS (
    SELECT DISTINCT e.id FROM firehouse.employees e
    LEFT JOIN firehouse.employee_profiles ep ON ep.employee_id=e.id
    WHERE e.active=1
      AND (NULLIF(ep.start_date,'') IS NULL OR ep.start_date<=to_char(now() AT TIME ZONE 'America/Chicago','YYYY-MM-DD'))
      AND (NULLIF(ep.end_date,'') IS NULL OR ep.end_date>=to_char(now() AT TIME ZONE 'America/Chicago','YYYY-MM-DD'))
      AND (lower(btrim(ep.email))=lower(btrim(p_email)) OR EXISTS (
        SELECT 1 FROM firehouse.employee_account_links l JOIN auth.users u ON u.id=l.user_id
        WHERE l.employee_id=e.id AND lower(btrim(u.email))=lower(btrim(p_email)) AND u.email_confirmed_at IS NOT NULL
      )) AND btrim(p_email)<>''
  ) SELECT CASE WHEN count(*)=1 THEN min(id) END FROM matches;
$$;
REVOKE ALL ON FUNCTION firehouse.employee_id_for_login(text) FROM PUBLIC,anon,authenticated;

-- Only called by the authenticated administrator API through the server SQL boundary.
CREATE FUNCTION firehouse.employee_account_setup() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object(
  'accounts',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',u.id,'email',u.email,
    'activated',u.email_confirmed_at IS NOT NULL AND u.last_sign_in_at IS NOT NULL AND EXISTS(SELECT 1 FROM public.portal_pin_credentials p WHERE p.user_id=u.id),
    'verified',u.email_confirmed_at IS NOT NULL,'employeeId',firehouse.employee_id_for_login(u.email)))
    FROM auth.users u WHERE EXISTS(SELECT 1 FROM public.department_memberships m JOIN public.departments d ON d.id=m.department_id WHERE m.user_id=u.id AND m.status='active' AND d.slug='stickney-fire-department')), '[]'::jsonb),
  'invites',COALESCE((SELECT jsonb_agg(jsonb_build_object('email',i.email,'status',i.status,'expiresAt',i.expires_at))
    FROM public.department_invites i JOIN public.departments d ON d.id=i.department_id WHERE d.slug='stickney-fire-department'),'[]'::jsonb)
 );
$$;
REVOKE ALL ON FUNCTION firehouse.employee_account_setup() FROM PUBLIC,anon,authenticated;

CREATE FUNCTION firehouse.link_employee_account(p_user uuid,p_employee text,p_actor text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_email text; v_existing text;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('employee-account-link',0));
  SELECT u.email INTO v_email FROM auth.users u
  WHERE u.id=p_user AND u.email_confirmed_at IS NOT NULL AND EXISTS(
    SELECT 1 FROM public.department_memberships m JOIN public.departments d ON d.id=m.department_id
    WHERE m.user_id=u.id AND m.status='active' AND d.slug='stickney-fire-department');
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
-- Keep database permission decisions consistent with the server identity resolver.
DO $patch$
DECLARE definition text; needle text := 'WHERE e.active=1 AND lower(btrim(ep.email))=actor_email;';
BEGIN
 SELECT pg_get_functiondef('private.portal_has_permission(text)'::regprocedure) INTO definition;
 IF (length(definition)-length(replace(definition,needle,'')))/length(needle) <> 2 THEN
   RAISE EXCEPTION 'Permission definition changed; review before replacing identity lookup';
 END IF;
 EXECUTE replace(definition,needle,'WHERE e.id=firehouse.employee_id_for_login(actor_email);');
END $patch$;

-- Cache request identity once per statement; preserve the existing access predicates.
ALTER POLICY "Invited portal users can read their own approval" ON public.portal_access_emails
 USING(email=lower(COALESCE((SELECT auth.jwt())->>'email','')));
ALTER POLICY "Users can add their own push subscriptions" ON public.push_subscriptions TO authenticated
 WITH CHECK(user_id=(SELECT auth.uid()) AND department_id IN(SELECT public.current_department_ids()));
ALTER POLICY "Users can delete their own push subscriptions" ON public.push_subscriptions TO authenticated
 USING(user_id=(SELECT auth.uid()) OR public.can_manage_department(department_id));
ALTER POLICY "Users can update their own push subscriptions" ON public.push_subscriptions TO authenticated
 USING(user_id=(SELECT auth.uid()) OR public.can_manage_department(department_id))
 WITH CHECK((user_id=(SELECT auth.uid()) OR public.can_manage_department(department_id)) AND department_id IN(SELECT public.current_department_ids()));
-- Push endpoints and keys are device credentials; ordinary members may only read their own.
ALTER POLICY "Users can view department push subscriptions" ON public.push_subscriptions TO authenticated
 USING(user_id=(SELECT auth.uid()) OR public.can_manage_department(department_id));
COMMIT;
