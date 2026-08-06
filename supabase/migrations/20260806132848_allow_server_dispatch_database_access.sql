CREATE OR REPLACE FUNCTION firehouse.has_department_access()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    COALESCE(
      NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role' = 'service_role',
      false
    )
    OR COALESCE(public.is_platform_owner(), false)
    OR EXISTS (
      SELECT 1
      FROM public.department_memberships AS membership
      JOIN public.departments AS department ON department.id = membership.department_id
      WHERE membership.user_id = (SELECT auth.uid())
        AND membership.status = 'active'
        AND department.slug = 'stickney-fire-department'
    );
$$;

REVOKE ALL ON FUNCTION firehouse.has_department_access() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION firehouse.has_department_access() TO authenticated, service_role;

REVOKE ALL ON FUNCTION firehouse.execute_portal_sql(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION firehouse.execute_portal_sql(text, text, text) FROM anon;
GRANT USAGE ON SCHEMA firehouse TO service_role;
GRANT EXECUTE ON FUNCTION firehouse.execute_portal_sql(text, text, text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.firehouse_sql(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.firehouse_sql(text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.firehouse_sql(text, text, text) TO authenticated, service_role;
