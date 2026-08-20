insert into firehouse.system_meta(key, value, updated_at)
values (
  'runtime_bootstrap_version',
  'stickney-runtime-bootstrap-2026-08-07-station-scheduler-v1',
  to_char(current_timestamp at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS')
)
on conflict (key) do update
set value = excluded.value,
    updated_at = excluded.updated_at;
