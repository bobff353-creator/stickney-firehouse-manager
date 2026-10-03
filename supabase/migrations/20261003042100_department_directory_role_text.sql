DO $fix$
DECLARE definition text;
BEGIN
 SELECT pg_get_functiondef('department_gateway.department_portal_directory()'::regprocedure) INTO definition;
 EXECUTE replace(definition, 'coalesce(department.role,''owner'')', 'coalesce(department.role::text,''owner'')');
END $fix$;
NOTIFY pgrst,'reload schema';
