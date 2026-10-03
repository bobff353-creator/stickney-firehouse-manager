-- Keep privileged implementations outside PostgREST's exposed public schema.
CREATE SCHEMA department_gateway;
REVOKE ALL ON SCHEMA department_gateway FROM PUBLIC;
GRANT USAGE ON SCHEMA department_gateway TO anon,authenticated;
DO $body$
DECLARE f record; arglist text; role_name text;
BEGIN
 FOR f IN SELECT p.oid,p.proname,pg_get_function_arguments(p.oid) args,
 pg_get_function_identity_arguments(p.oid) identity_args,pg_get_functiondef(p.oid) def,p.proargnames,p.pronargs
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname LIKE 'department_%' AND p.prosecdef LOOP
   EXECUTE replace(f.def,'CREATE OR REPLACE FUNCTION public.','CREATE OR REPLACE FUNCTION department_gateway.');
   EXECUTE format('REVOKE ALL ON FUNCTION department_gateway.%I(%s) FROM PUBLIC,anon,authenticated,service_role',f.proname,f.identity_args);
   FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
     IF has_function_privilege(role_name,f.oid,'EXECUTE') THEN EXECUTE format('GRANT EXECUTE ON FUNCTION department_gateway.%I(%s) TO %I',f.proname,f.identity_args,role_name); END IF;
   END LOOP;
   SELECT string_agg(quote_ident(name),',') INTO arglist FROM unnest(f.proargnames[1:f.pronargs]) name;
   EXECUTE format('CREATE OR REPLACE FUNCTION public.%I(%s) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='''' AS %L',f.proname,f.args,format('SELECT department_gateway.%I(%s)',f.proname,coalesce(arglist,'')));
 END LOOP;
END $body$;
NOTIFY pgrst,'reload schema';
