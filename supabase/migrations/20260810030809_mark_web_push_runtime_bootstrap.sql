DO $$
BEGIN
  IF to_regclass('firehouse.push_subscriptions') IS NULL THEN
    RAISE EXCEPTION 'Cannot advance runtime bootstrap marker before push_subscriptions exists';
  END IF;

  INSERT INTO firehouse.system_meta (key, value, updated_at)
  VALUES (
    'runtime_bootstrap_version',
    'stickney-runtime-bootstrap-2026-08-09-station-scheduler-v3-web-push-v1',
    (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::text
  )
  ON CONFLICT (key) DO UPDATE
  SET value = excluded.value,
      updated_at = excluded.updated_at;
END;
$$;
