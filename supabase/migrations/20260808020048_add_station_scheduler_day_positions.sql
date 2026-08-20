alter table firehouse.station_shift_slots
  add column if not exists start_time text not null default '',
  add column if not exists end_time text not null default '',
  add column if not exists is_extra integer not null default 0;

insert into firehouse.system_meta(key, value, updated_at)
values (
  'runtime_bootstrap_version',
  'stickney-runtime-bootstrap-2026-08-08-station-scheduler-v3',
  to_char(current_timestamp at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS')
)
on conflict (key) do update
set value = excluded.value,
    updated_at = excluded.updated_at;
