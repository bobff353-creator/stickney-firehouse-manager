create table if not exists firehouse.road_closures (
  id text primary key,
  road_name text not null,
  reason text not null default '',
  path_json text not null default '[]',
  detour_latitude double precision not null,
  detour_longitude double precision not null,
  status text not null default 'active' check (status in ('active', 'cleared')),
  started_at timestamptz not null default now(),
  expected_clear_at timestamptz,
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_by text not null,
  updated_at timestamptz not null default now(),
  cleared_by text,
  cleared_at timestamptz,
  clear_note text not null default ''
);

create index if not exists road_closures_status_started_idx
  on firehouse.road_closures(status, started_at desc);

alter table firehouse.road_closures enable row level security;

drop policy if exists road_closures_department_access on firehouse.road_closures;
create policy road_closures_department_access
  on firehouse.road_closures
  for all
  to authenticated
  using ((select firehouse.has_department_access()))
  with check ((select firehouse.has_department_access()));

grant select, insert, update on firehouse.road_closures to authenticated;
