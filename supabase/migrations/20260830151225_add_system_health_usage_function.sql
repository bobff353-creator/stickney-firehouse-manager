DROP FUNCTION IF EXISTS firehouse.system_health_usage();

CREATE FUNCTION firehouse.system_health_usage()
RETURNS TABLE(
  database_bytes bigint,
  storage_bytes bigint,
  object_count bigint,
  bucket_count bigint,
  auth_user_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT firehouse.has_department_access() THEN
    RAISE EXCEPTION 'Stickney department access required' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    pg_database_size(current_database())::bigint,
    (SELECT COALESCE(SUM(
      CASE
        WHEN objects.metadata->>'size' ~ '^[0-9]+$'
          THEN (objects.metadata->>'size')::bigint
        ELSE 0
      END
    ), 0)::bigint FROM storage.objects AS objects),
    (SELECT COUNT(*)::bigint FROM storage.objects),
    (SELECT COUNT(*)::bigint FROM storage.buckets),
    (SELECT COUNT(*)::bigint FROM auth.users);
END;
$$;

REVOKE ALL ON FUNCTION firehouse.system_health_usage() FROM PUBLIC;
REVOKE ALL ON FUNCTION firehouse.system_health_usage() FROM anon;
GRANT USAGE ON SCHEMA firehouse TO authenticated;
GRANT EXECUTE ON FUNCTION firehouse.system_health_usage() TO authenticated;
