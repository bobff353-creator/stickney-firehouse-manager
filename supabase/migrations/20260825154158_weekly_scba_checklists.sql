create table if not exists public.inventory_scba_templates (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments(id) on delete cascade,
  apparatus_id uuid not null references public.inventory_apparatus_profiles(id) on delete cascade,
  pack_positions text[] not null default array[]::text[],
  include_rit boolean not null default true,
  spare_bottle_count smallint not null default 0 check (spare_bottle_count between 0 and 20),
  active boolean not null default true,
  created_by text,
  created_at timestamptz not null default now(),
  updated_by text,
  updated_at timestamptz not null default now(),
  unique (department_id, apparatus_id),
  check (cardinality(pack_positions) between 0 and 12),
  check (cardinality(pack_positions) > 0 or include_rit or spare_bottle_count > 0)
);

create table if not exists public.inventory_scba_check_entries (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments(id) on delete cascade,
  check_id uuid not null references public.inventory_checks(id) on delete cascade,
  section text not null check (section in ('pack','rit','spare')),
  label text not null,
  sort_order integer not null default 0,
  harness_number text,
  cylinder_number text,
  psi smallint check (psi between 0 and 6000),
  result text not null default 'pending' check (result in ('pending','pass','failed','not_applicable')),
  notes text,
  checked_by text,
  checked_at timestamptz,
  created_at timestamptz not null default now(),
  unique (check_id, sort_order)
);

create index if not exists inventory_scba_templates_department_idx
  on public.inventory_scba_templates(department_id, apparatus_id);
create index if not exists inventory_scba_check_entries_check_idx
  on public.inventory_scba_check_entries(department_id, check_id, sort_order);

alter table public.inventory_scba_templates enable row level security;
alter table public.inventory_scba_check_entries enable row level security;

drop policy if exists inventory_scba_templates_select on public.inventory_scba_templates;
drop policy if exists inventory_scba_templates_insert on public.inventory_scba_templates;
drop policy if exists inventory_scba_templates_update on public.inventory_scba_templates;
drop policy if exists inventory_scba_templates_delete on public.inventory_scba_templates;
create policy inventory_scba_templates_select
  on public.inventory_scba_templates for select to authenticated
  using (private.inventory_can_access(department_id));
create policy inventory_scba_templates_insert
  on public.inventory_scba_templates for insert to authenticated
  with check (private.inventory_can_admin(department_id));
create policy inventory_scba_templates_update
  on public.inventory_scba_templates for update to authenticated
  using (private.inventory_can_admin(department_id))
  with check (private.inventory_can_admin(department_id));
create policy inventory_scba_templates_delete
  on public.inventory_scba_templates for delete to authenticated
  using (private.inventory_can_admin(department_id));

drop policy if exists inventory_scba_check_entries_select on public.inventory_scba_check_entries;
drop policy if exists inventory_scba_check_entries_insert on public.inventory_scba_check_entries;
drop policy if exists inventory_scba_check_entries_update on public.inventory_scba_check_entries;
create policy inventory_scba_check_entries_select
  on public.inventory_scba_check_entries for select to authenticated
  using (private.inventory_can_access(department_id));
create policy inventory_scba_check_entries_insert
  on public.inventory_scba_check_entries for insert to authenticated
  with check (private.inventory_can_write(department_id));
create policy inventory_scba_check_entries_update
  on public.inventory_scba_check_entries for update to authenticated
  using (private.inventory_can_write(department_id))
  with check (private.inventory_can_write(department_id));

revoke all on public.inventory_scba_templates from public, anon;
revoke all on public.inventory_scba_check_entries from public, anon;
grant select, insert, update, delete on public.inventory_scba_templates to authenticated;
grant select, insert, update on public.inventory_scba_check_entries to authenticated;

insert into public.inventory_scba_templates (
  department_id, apparatus_id, pack_positions, include_rit, spare_bottle_count,
  active, created_by, updated_by
)
select
  profile.department_id,
  profile.id,
  array['Officer Seat / Ambulance Passenger','Engineer / Ambulance Driver','Rear Left','Rear Middle','Rear Right']::text[],
  true,
  7,
  true,
  'Initial Weekly SCBA setup',
  'Initial Weekly SCBA setup'
from public.inventory_apparatus_profiles profile
join public.departments department on department.id = profile.department_id
where lower(department.name) like 'stickney%'
  and lower(profile.name) <> '1211'
  and lower(profile.name) not like '%utv%'
  and lower(coalesce(profile.asset_type, '')) <> 'utv'
on conflict (department_id, apparatus_id) do nothing;

insert into public.inventory_inspection_schedules (
  department_id, apparatus_id, check_type, day_of_week, start_time, end_time,
  active, feeds_daily_duties, feeds_operations_board, require_officer_signoff,
  created_by, updated_by
)
select
  template.department_id,
  template.apparatus_id,
  'air_pack',
  coalesce(profile.weekly_due_day, 1),
  time '06:00',
  time '12:00',
  true,
  true,
  true,
  true,
  'Initial Weekly SCBA setup',
  'Initial Weekly SCBA setup'
from public.inventory_scba_templates template
join public.inventory_apparatus_profiles profile
  on profile.department_id = template.department_id and profile.id = template.apparatus_id
on conflict (department_id, apparatus_id, check_type, day_of_week) do nothing;

comment on table public.inventory_scba_templates is
  'Administrator-editable weekly SCBA layout by apparatus, including riding positions, RIT bag, and spare-cylinder count.';
comment on table public.inventory_scba_check_entries is
  'Saved weekly SCBA pack, RIT, and spare-cylinder readings attached to the standard apparatus check approval workflow.';
