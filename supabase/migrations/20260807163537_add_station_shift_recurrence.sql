alter table firehouse.station_shift_types
  add column if not exists anchor_date text not null default '',
  add column if not exists repeat_every_days integer not null default 0;

alter table firehouse.station_shift_types
  drop constraint if exists station_shift_types_repeat_every_days_check;

alter table firehouse.station_shift_types
  add constraint station_shift_types_repeat_every_days_check
  check (repeat_every_days between 0 and 365);

insert into firehouse.system_meta(key, value, updated_at)
values (
  'runtime_bootstrap_version',
  'stickney-runtime-bootstrap-2026-08-07-station-scheduler-v2',
  to_char(current_timestamp at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS')
)
on conflict (key) do update
set value = excluded.value,
    updated_at = excluded.updated_at;
