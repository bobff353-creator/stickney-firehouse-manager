-- Application version conflicts are permanent for the submitted payload.
-- PostgREST 14 retries SQLSTATE 40001 indefinitely; return HTTP 409 instead.
-- Keep every statement, authorization check, transaction, and ACL unchanged.
DO $migration$
DECLARE signature text; definition text;
BEGIN
  FOREACH signature IN ARRAY ARRAY[
    'public.firehouse_sql_batch(jsonb,text)',
    'public.firehouse_server_sql_batch(jsonb,text)',
    'public.inventory_save_air_asset(uuid,uuid,timestamp with time zone,jsonb)'
  ] LOOP
    SELECT pg_get_functiondef(signature::regprocedure) INTO definition;
    IF position('''40001''' IN definition) = 0 THEN
      IF position('''PT409''' IN definition) = 0 THEN
        RAISE EXCEPTION 'Expected version-conflict guard in %', signature;
      END IF;
    ELSE
      EXECUTE replace(definition, '''40001''', '''PT409''');
    END IF;
  END LOOP;
END $migration$;
