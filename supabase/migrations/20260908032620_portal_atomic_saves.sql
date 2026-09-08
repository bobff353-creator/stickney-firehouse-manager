-- These invoker wrappers retain the existing executor's credential/membership
-- and SQL checks for EVERY statement. An exception rolls back the entire RPC.
CREATE FUNCTION public.firehouse_sql_batch(p_statements jsonb, p_secret text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE item jsonb; result jsonb; results jsonb := '[]'::jsonb;
BEGIN
  PERFORM public.firehouse_sql('SELECT 1', 'first', p_secret);
  IF jsonb_typeof(p_statements) IS DISTINCT FROM 'array' OR jsonb_array_length(p_statements) > 2000 THEN
    RAISE EXCEPTION 'Invalid transaction';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(74192026);
  FOR item IN SELECT value FROM jsonb_array_elements(p_statements) LOOP
    result := public.firehouse_sql(item->>'sql', COALESCE(item->>'mode','run'), p_secret);
    IF item->>'requiredChanges' IS NOT NULL AND (result#>>'{meta,changes}')::bigint IS DISTINCT FROM (item->>'requiredChanges')::bigint THEN
      RAISE EXCEPTION 'SAVE_CONFLICT: The record changed. Reload and review before saving.' USING ERRCODE = '40001';
    END IF;
    results := results || jsonb_build_array(result);
  END LOOP;
  RETURN results;
END $$;
REVOKE ALL ON FUNCTION public.firehouse_sql_batch(jsonb,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.firehouse_sql_batch(jsonb,text) TO anon, authenticated;

CREATE FUNCTION public.firehouse_server_sql_batch(p_statements jsonb, p_secret text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE item jsonb; result jsonb; results jsonb := '[]'::jsonb;
BEGIN
  PERFORM public.firehouse_server_sql('SELECT 1', 'first', p_secret);
  IF jsonb_typeof(p_statements) IS DISTINCT FROM 'array' OR jsonb_array_length(p_statements) > 2000 THEN
    RAISE EXCEPTION 'Invalid transaction';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(74192026);
  FOR item IN SELECT value FROM jsonb_array_elements(p_statements) LOOP
    result := public.firehouse_server_sql(item->>'sql', COALESCE(item->>'mode','run'), p_secret);
    IF item->>'requiredChanges' IS NOT NULL AND (result#>>'{meta,changes}')::bigint IS DISTINCT FROM (item->>'requiredChanges')::bigint THEN
      RAISE EXCEPTION 'SAVE_CONFLICT: The record changed. Reload and review before saving.' USING ERRCODE = '40001';
    END IF;
    results := results || jsonb_build_array(result);
  END LOOP;
  RETURN results;
END $$;
REVOKE ALL ON FUNCTION public.firehouse_server_sql_batch(jsonb,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.firehouse_server_sql_batch(jsonb,text) TO anon;

-- Finalization and entry writes lock the same period row. Checking only the
-- web page would allow a concurrent or older client to write closed payroll.
CREATE FUNCTION firehouse.protect_finalized_time_entry()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE period record; starts text[] := ARRAY[]::text[];
BEGIN
  IF TG_OP <> 'INSERT' THEN starts := array_append(starts, OLD.period_start); END IF;
  IF TG_OP <> 'DELETE' THEN starts := array_append(starts, NEW.period_start); END IF;
  FOR period IN SELECT start_date,status FROM firehouse.pay_periods WHERE start_date = ANY(starts) ORDER BY start_date FOR UPDATE LOOP
    IF period.status = 'finalized' THEN
      RAISE EXCEPTION 'PAYROLL_FINALIZED: Reopen this payroll period before changing hours.' USING ERRCODE = '55000';
    END IF;
  END LOOP;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION firehouse.protect_finalized_time_entry() FROM PUBLIC;
CREATE TRIGGER protect_finalized_time_entry BEFORE INSERT OR UPDATE OR DELETE ON firehouse.time_entries
FOR EACH ROW EXECUTE FUNCTION firehouse.protect_finalized_time_entry();

ALTER TABLE firehouse.daily_logs ADD COLUMN save_version bigint NOT NULL DEFAULT 0;
CREATE FUNCTION firehouse.bump_daily_log_version()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF NEW IS DISTINCT FROM OLD THEN NEW.save_version := OLD.save_version + 1; END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION firehouse.bump_daily_log_version() FROM PUBLIC;
CREATE TRIGGER bump_daily_log_version BEFORE UPDATE ON firehouse.daily_logs
FOR EACH ROW EXECUTE FUNCTION firehouse.bump_daily_log_version();

CREATE FUNCTION firehouse.bump_linked_log_version()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN
    UPDATE firehouse.daily_logs SET save_version = save_version + 1 WHERE log_date = OLD.log_date;
  END IF;
  IF TG_OP <> 'DELETE' AND (TG_OP = 'INSERT' OR NEW.log_date IS DISTINCT FROM OLD.log_date) THEN
    UPDATE firehouse.daily_logs SET save_version = save_version + 1 WHERE log_date = NEW.log_date;
  END IF;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION firehouse.bump_linked_log_version() FROM PUBLIC;
CREATE TRIGGER staffing_changes_log_version AFTER INSERT OR UPDATE OR DELETE ON firehouse.daily_log_staffing
FOR EACH ROW EXECUTE FUNCTION firehouse.bump_linked_log_version();
CREATE TRIGGER call_changes_log_version AFTER INSERT OR UPDATE OR DELETE ON firehouse.daily_log_calls
FOR EACH ROW EXECUTE FUNCTION firehouse.bump_linked_log_version();
