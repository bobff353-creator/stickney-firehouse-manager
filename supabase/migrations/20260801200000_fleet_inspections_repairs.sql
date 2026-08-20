alter table public.inventory_equipment
  add column if not exists equipment_category text not null default 'equipment',
  add column if not exists check_types text[] not null default array['daily','weekly','inventory']::text[];

alter table public.inventory_equipment
  drop constraint if exists inventory_equipment_equipment_category_check;
alter table public.inventory_equipment
  add constraint inventory_equipment_equipment_category_check
  check (equipment_category in ('vehicle','air_pack','equipment'));

alter table public.inventory_checks
  add column if not exists check_type text not null default 'inventory';
alter table public.inventory_checks
  drop constraint if exists inventory_checks_check_type_check;
alter table public.inventory_checks
  add constraint inventory_checks_check_type_check
  check (check_type in ('daily','weekly','inventory','air_pack'));

alter table public.inventory_check_items
  drop constraint if exists inventory_check_items_result_check;
alter table public.inventory_check_items
  add constraint inventory_check_items_result_check
  check (result in ('pending','pass','failed','missing','damaged','not_applicable'));

create table if not exists public.inventory_deficiency_photos (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments(id) on delete restrict,
  apparatus_id uuid not null references public.inventory_apparatus_profiles(id) on delete restrict,
  check_item_id uuid references public.inventory_check_items(id) on delete restrict,
  object_key text not null unique,
  original_filename text not null,
  mime_type text not null,
  byte_size bigint not null check (byte_size > 0 and byte_size <= 20971520),
  captured_by text not null,
  captured_at timestamptz not null default now()
);

alter table public.inventory_readiness_exceptions
  add column if not exists issue_categories text[] not null default array['equipment']::text[],
  add column if not exists assigned_employee_ids text[] not null default '{}'::text[],
  add column if not exists assigned_employee_names text[] not null default '{}'::text[],
  add column if not exists evidence_photo_id uuid references public.inventory_deficiency_photos(id) on delete restrict,
  add column if not exists resolved_by text,
  add column if not exists resolution_notes text;

alter table public.inventory_work_orders
  add column if not exists linked_exception_id uuid references public.inventory_readiness_exceptions(id) on delete restrict,
  add column if not exists assigned_employee_ids text[] not null default '{}'::text[],
  add column if not exists assigned_employee_names text[] not null default '{}'::text[],
  add column if not exists repair_date date,
  add column if not exists repair_cost numeric(12,2),
  add column if not exists vendor text,
  add column if not exists invoice_number text,
  add column if not exists resolution_notes text,
  add column if not exists closed_by text;

alter table public.inventory_work_orders
  drop constraint if exists inventory_work_orders_repair_cost_check;
alter table public.inventory_work_orders
  add constraint inventory_work_orders_repair_cost_check
  check (repair_cost is null or repair_cost >= 0);

create index if not exists inventory_equipment_check_types_idx
  on public.inventory_equipment using gin(check_types);
create index if not exists inventory_exceptions_assignees_idx
  on public.inventory_readiness_exceptions using gin(assigned_employee_ids);
create index if not exists inventory_work_orders_assignees_idx
  on public.inventory_work_orders using gin(assigned_employee_ids);
create index if not exists inventory_work_orders_exception_idx
  on public.inventory_work_orders(department_id, linked_exception_id);
create index if not exists inventory_deficiency_photos_apparatus_idx
  on public.inventory_deficiency_photos(department_id, apparatus_id, captured_at desc);

alter table public.inventory_deficiency_photos enable row level security;
drop policy if exists inventory_deficiency_photos_select on public.inventory_deficiency_photos;
drop policy if exists inventory_deficiency_photos_insert on public.inventory_deficiency_photos;
drop policy if exists inventory_deficiency_photos_update on public.inventory_deficiency_photos;
create policy inventory_deficiency_photos_select
  on public.inventory_deficiency_photos for select to authenticated
  using (private.inventory_can_access(department_id));
create policy inventory_deficiency_photos_insert
  on public.inventory_deficiency_photos for insert to authenticated
  with check (private.inventory_can_write(department_id));
create policy inventory_deficiency_photos_update
  on public.inventory_deficiency_photos for update to authenticated
  using (private.inventory_can_write(department_id))
  with check (private.inventory_can_write(department_id));
grant select, insert, update on public.inventory_deficiency_photos to authenticated;
