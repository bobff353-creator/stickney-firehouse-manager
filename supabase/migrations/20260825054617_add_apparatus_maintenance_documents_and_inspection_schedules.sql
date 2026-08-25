alter table public.inventory_work_orders
  add column if not exists service_type text not null default 'repair',
  add column if not exists odometer integer,
  add column if not exists labor_hours numeric(8,2),
  add column if not exists performed_by text,
  add column if not exists parts_used text,
  add column if not exists next_service_due_date date,
  add column if not exists next_service_due_mileage integer;

alter table public.inventory_work_orders
  drop constraint if exists inventory_work_orders_service_type_check,
  drop constraint if exists inventory_work_orders_odometer_check,
  drop constraint if exists inventory_work_orders_labor_hours_check,
  drop constraint if exists inventory_work_orders_next_mileage_check;
alter table public.inventory_work_orders
  add constraint inventory_work_orders_service_type_check
    check (service_type in ('inspection','preventive','repair','recall','tires','fluids','electrical','body','other')),
  add constraint inventory_work_orders_odometer_check check (odometer is null or odometer >= 0),
  add constraint inventory_work_orders_labor_hours_check check (labor_hours is null or labor_hours >= 0),
  add constraint inventory_work_orders_next_mileage_check check (next_service_due_mileage is null or next_service_due_mileage >= 0);

create table if not exists public.inventory_work_order_documents (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments(id) on delete restrict,
  apparatus_id uuid not null references public.inventory_apparatus_profiles(id) on delete restrict,
  work_order_id uuid not null references public.inventory_work_orders(id) on delete cascade,
  document_type text not null default 'other'
    check (document_type in ('service_ticket','receipt','invoice','photo','warranty','inspection','other')),
  object_key text not null unique,
  original_filename text not null,
  mime_type text not null,
  byte_size bigint not null check (byte_size > 0 and byte_size <= 20971520),
  note text,
  uploaded_by text not null,
  uploaded_at timestamptz not null default now()
);

create index if not exists inventory_work_order_documents_history_idx
  on public.inventory_work_order_documents(department_id, apparatus_id, uploaded_at desc);
create index if not exists inventory_work_order_documents_order_idx
  on public.inventory_work_order_documents(work_order_id, uploaded_at desc);

alter table public.inventory_work_order_documents enable row level security;
drop policy if exists inventory_work_order_documents_select on public.inventory_work_order_documents;
drop policy if exists inventory_work_order_documents_insert on public.inventory_work_order_documents;
drop policy if exists inventory_work_order_documents_update on public.inventory_work_order_documents;
drop policy if exists inventory_work_order_documents_delete on public.inventory_work_order_documents;
create policy inventory_work_order_documents_select
  on public.inventory_work_order_documents for select to authenticated
  using (private.inventory_can_access(department_id));
create policy inventory_work_order_documents_insert
  on public.inventory_work_order_documents for insert to authenticated
  with check (private.inventory_can_write(department_id));
create policy inventory_work_order_documents_update
  on public.inventory_work_order_documents for update to authenticated
  using (private.inventory_can_write(department_id))
  with check (private.inventory_can_write(department_id));
create policy inventory_work_order_documents_delete
  on public.inventory_work_order_documents for delete to authenticated
  using (private.inventory_can_write(department_id));
grant select, insert, update, delete on public.inventory_work_order_documents to authenticated;

create table if not exists public.inventory_inspection_schedules (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments(id) on delete restrict,
  apparatus_id uuid not null references public.inventory_apparatus_profiles(id) on delete cascade,
  check_type text not null check (check_type in ('daily','weekly','inventory','air_pack')),
  day_of_week smallint not null check (day_of_week between 0 and 6),
  start_time time not null default '06:00',
  end_time time not null default '12:00',
  active boolean not null default true,
  feeds_daily_duties boolean not null default true,
  feeds_operations_board boolean not null default true,
  require_officer_signoff boolean not null default true,
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_by text not null,
  updated_at timestamptz not null default now(),
  unique (department_id, apparatus_id, check_type, day_of_week),
  check (end_time > start_time)
);

create index if not exists inventory_inspection_schedules_due_idx
  on public.inventory_inspection_schedules(department_id, day_of_week, active, start_time, end_time);

alter table public.inventory_inspection_schedules enable row level security;
drop policy if exists inventory_inspection_schedules_select on public.inventory_inspection_schedules;
drop policy if exists inventory_inspection_schedules_insert on public.inventory_inspection_schedules;
drop policy if exists inventory_inspection_schedules_update on public.inventory_inspection_schedules;
drop policy if exists inventory_inspection_schedules_delete on public.inventory_inspection_schedules;
create policy inventory_inspection_schedules_select
  on public.inventory_inspection_schedules for select to authenticated
  using (private.inventory_can_access(department_id));
create policy inventory_inspection_schedules_insert
  on public.inventory_inspection_schedules for insert to authenticated
  with check (private.inventory_can_write(department_id));
create policy inventory_inspection_schedules_update
  on public.inventory_inspection_schedules for update to authenticated
  using (private.inventory_can_write(department_id))
  with check (private.inventory_can_write(department_id));
create policy inventory_inspection_schedules_delete
  on public.inventory_inspection_schedules for delete to authenticated
  using (private.inventory_can_write(department_id));
grant select, insert, update, delete on public.inventory_inspection_schedules to authenticated;

-- Preserve the current daily-check behavior while moving it into an editable schedule.
insert into public.inventory_inspection_schedules (
  department_id, apparatus_id, check_type, day_of_week, start_time, end_time,
  created_by, updated_by
)
select distinct equipment.department_id, equipment.apparatus_id, 'daily', day_number, time '06:00', time '12:00',
  'Existing fleet configuration', 'Existing fleet configuration'
from public.inventory_equipment equipment
cross join generate_series(0, 6) as day_number
where equipment.retired_at is null and equipment.check_types @> array['daily']::text[]
on conflict (department_id, apparatus_id, check_type, day_of_week) do nothing;

-- Preserve each apparatus weekly due day and make its time window editable.
insert into public.inventory_inspection_schedules (
  department_id, apparatus_id, check_type, day_of_week, start_time, end_time,
  created_by, updated_by
)
select department_id, id, 'weekly', weekly_due_day, time '06:00', time '12:00',
  'Existing fleet configuration', 'Existing fleet configuration'
from public.inventory_apparatus_profiles
where weekly_due_day is not null
on conflict (department_id, apparatus_id, check_type, day_of_week) do nothing;

update storage.buckets
set allowed_mime_types = array[
  'image/jpeg','image/png','image/webp','image/heic','image/heif','application/pdf'
]
where id = 'stickney-inventory-media';
