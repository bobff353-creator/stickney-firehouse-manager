CREATE OR REPLACE FUNCTION firehouse.execute_server_portal_sql(
  p_sql text,
  p_mode text DEFAULT 'all',
  p_secret text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = firehouse, extensions, pg_temp
AS $$
DECLARE
  result jsonb;
  affected bigint;
BEGIN
  IF p_secret IS NULL
     OR encode(extensions.digest(btrim(p_secret), 'sha256'), 'hex') <> '4f50aa6cea4730aa34556b2ecebe8d7a0b5fc03dc1cfcb7fe4557666da97e6c2' THEN
    RAISE EXCEPTION 'Invalid portal database credential' USING ERRCODE = '42501';
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

REVOKE ALL ON FUNCTION firehouse.execute_server_portal_sql(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION firehouse.execute_server_portal_sql(text, text, text) FROM authenticated;
REVOKE ALL ON FUNCTION firehouse.execute_server_portal_sql(text, text, text) FROM service_role;
GRANT EXECUTE ON FUNCTION firehouse.execute_server_portal_sql(text, text, text) TO anon;
