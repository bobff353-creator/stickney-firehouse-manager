-- REVIEW ONLY. Apply in approved isolation first, then migration-first release.
-- Additive representation: existing clock labels, payroll and history unchanged.
-- Empty means no explicit endpoint selected; the app resolves unambiguous times.
-- UTC instants are validated against Chicago date/clock candidates by the app.
DO $body$
DECLARE target record; table_name text; column_name text;
BEGIN
  FOR target IN SELECT nspname FROM pg_namespace
    WHERE nspname='firehouse' OR nspname ~ '^department_[a-f0-9]{32}$'
  LOOP
    FOREACH table_name IN ARRAY ARRAY['daily_log_staffing','work_detail_requests'] LOOP
      IF to_regclass(format('%I.%I',target.nspname,table_name)) IS NULL THEN CONTINUE; END IF;
      FOREACH column_name IN ARRAY ARRAY['time_in_instant','time_out_instant'] LOOP
        EXECUTE format('ALTER TABLE %I.%I ADD COLUMN IF NOT EXISTS %I text NOT NULL DEFAULT %L CHECK (%I = %L OR %I ~ %L)',
          target.nspname,table_name,column_name,'',column_name,'',column_name,
          '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}[.][0-9]{3}Z$');
      END LOOP;
    END LOOP;
  END LOOP;
END $body$;
-- No UPDATE/backfill, grants, policies, credentials or notification changes.
