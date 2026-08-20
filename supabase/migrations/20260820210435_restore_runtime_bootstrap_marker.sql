do $$
declare
  missing_columns text[];
begin
  if to_regclass('firehouse.station_shift_types') is null
     or to_regclass('firehouse.station_shift_slots') is null
     or to_regclass('firehouse.push_subscriptions') is null
     or to_regclass('firehouse.callback_review_settings') is null
     or to_regclass('firehouse.daily_log_callback_submissions') is null then
    raise exception 'Required Aug 10 portal schema is missing; bootstrap marker was not advanced';
  end if;

  select array_agg(required.column_name order by required.column_name)
  into missing_columns
  from (
    values
      ('call_type'),
      ('call_time_out'),
      ('call_time_in'),
      ('rule_version'),
      ('rule_matches'),
      ('rule_flags'),
      ('suggested_hours'),
      ('actual_minutes'),
      ('approved_hours'),
      ('submitted_by_employee_id'),
      ('submitted_by_rank')
  ) as required(column_name)
  where not exists (
    select 1
    from information_schema.columns as portal_column
    where portal_column.table_schema = 'firehouse'
      and portal_column.table_name = 'daily_log_callback_submissions'
      and portal_column.column_name = required.column_name
  );

  if missing_columns is not null then
    raise exception 'Required callback columns are missing: %', array_to_string(missing_columns, ', ');
  end if;

  if not exists (
    select 1
    from firehouse.callback_review_settings
    where id = 'default'
  ) then
    raise exception 'Default callback review settings are missing; bootstrap marker was not advanced';
  end if;

  insert into firehouse.system_meta(key, value, updated_at)
  values (
    'runtime_bootstrap_version',
    'stickney-runtime-bootstrap-2026-08-10-callback-rules-v2',
    now()
  )
  on conflict(key) do update set
    value = excluded.value,
    updated_at = excluded.updated_at;
end $$;
