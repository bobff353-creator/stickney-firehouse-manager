-- Department creation already requires is_platform_owner(). Remove the
-- unnecessary anonymous entry point without changing signed-in owner access.
REVOKE EXECUTE ON FUNCTION public.create_department_with_admin(text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_department_with_admin(text, text, text, text, text) TO authenticated, service_role;
