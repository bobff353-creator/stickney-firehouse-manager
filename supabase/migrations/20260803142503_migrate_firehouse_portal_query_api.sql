
RESET search_path;

CREATE OR REPLACE FUNCTION public.firehouse_sql(p_sql text, p_mode text DEFAULT 'all')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = firehouse, pg_temp
AS $$
DECLARE
  result jsonb;
  affected bigint;
BEGIN
  IF NOT firehouse.has_department_access() THEN
    RAISE EXCEPTION 'Department access is required' USING ERRCODE = '42501';
  END IF;
  IF p_sql IS NULL OR length(p_sql) > 200000 OR p_sql ~ '(;|--|/\*|\*/)' THEN
    RAISE EXCEPTION 'Unsafe portal query';
  END IF;
  IF p_sql ~* '\m(public|auth|storage|extensions|vault|realtime|graphql)\s*\.' THEN
    RAISE EXCEPTION 'Cross-schema portal query denied';
  END IF;
  IF p_sql !~* '^\s*(select|insert|update|delete|with)\M'
     OR p_sql ~* '\m(create|alter|drop|truncate|grant|revoke|copy|call|do|set|show|reset|listen|notify|vacuum|analyze)\M' THEN
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
$$;
REVOKE ALL ON FUNCTION public.firehouse_sql(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.firehouse_sql(text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.firehouse_sql(text, text) TO authenticated;
