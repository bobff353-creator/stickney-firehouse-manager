CREATE OR REPLACE FUNCTION firehouse.execute_portal_sql(p_secret text, p_statement text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, firehouse, extensions
AS $$
DECLARE
  v_sql text := btrim(coalesce(p_statement, ''));
  v_result jsonb;
BEGIN
  IF p_secret IS NULL
     OR encode(extensions.digest(p_secret, 'sha256'), 'hex') <> 'e24dbd461a03c2cb420496b13d7d50657d7c8396cfa10951cc00257fb9abdc37' THEN
    RAISE EXCEPTION 'Invalid portal database credential' USING ERRCODE = '42501';
  END IF;

  IF v_sql = '' OR length(v_sql) > 200000 THEN
    RAISE EXCEPTION 'Invalid portal query' USING ERRCODE = '22023';
  END IF;

  IF v_sql ~ ';[[:space:]]*[^[:space:]]' OR v_sql ~ '--' OR v_sql ~ '/\*' OR v_sql ~ '\*/' THEN
    RAISE EXCEPTION 'Multiple statements and comments are not allowed' USING ERRCODE = '42501';
  END IF;

  IF lower(v_sql) !~ '^(select|insert|update|delete|with)[[:space:]]' THEN
    RAISE EXCEPTION 'Unsupported portal query' USING ERRCODE = '42501';
  END IF;

  IF lower(v_sql) ~ '(copy|alter|create|drop|truncate|grant|revoke|comment|vacuum|analyze|refresh|reindex|cluster|listen|notify|do)[[:space:]]' THEN
    RAISE EXCEPTION 'Unsafe portal query' USING ERRCODE = '42501';
  END IF;

  IF lower(v_sql) !~ '(^|[^a-z0-9_])firehouse\.' THEN
    RAISE EXCEPTION 'Portal query must target the firehouse schema' USING ERRCODE = '42501';
  END IF;

  IF lower(v_sql) ~ '(^|[^a-z0-9_])(auth|storage|vault|pg_catalog|information_schema|public)\.' THEN
    RAISE EXCEPTION 'Portal query references a restricted schema' USING ERRCODE = '42501';
  END IF;

  IF lower(v_sql) ~ '^select[[:space:]]' OR lower(v_sql) ~ '^with[[:space:]]' THEN
    EXECUTE format('SELECT coalesce(jsonb_agg(to_jsonb(q)), ''[]''::jsonb) FROM (%s) q', v_sql)
      INTO v_result;
    RETURN coalesce(v_result, '[]'::jsonb);
  END IF;

  EXECUTE v_sql;
  RETURN jsonb_build_object('rowsAffected', 1);
END;
$$;

REVOKE ALL ON FUNCTION firehouse.execute_portal_sql(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION firehouse.execute_portal_sql(text, text) FROM anon;
REVOKE ALL ON FUNCTION firehouse.execute_portal_sql(text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION firehouse.execute_portal_sql(text, text) TO service_role;
