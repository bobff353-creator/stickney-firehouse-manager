create schema if not exists private;

insert into public.departments (name, slug, city, state)
values ('Stickney Fire Department', 'stickney-fire-department', 'Stickney', 'IL')
on conflict (slug) do nothing;

create or replace function private.inventory_can_access(target_department_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_platform_owner()
    or exists (
      select 1
      from public.department_memberships as membership
      where membership.department_id = target_department_id
        and membership.user_id = (select auth.uid())
        and membership.status = 'active'
    );
$$;

create or replace function private.inventory_can_write(target_department_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_platform_owner()
    or exists (
      select 1
      from public.department_memberships as membership
      where membership.department_id = target_department_id
        and membership.user_id = (select auth.uid())
        and membership.status = 'active'
        and membership.role in ('admin', 'chief', 'inspector', 'user')
    );
$$;

revoke all on function private.inventory_can_access(uuid) from public;
revoke all on function private.inventory_can_write(uuid) from public;
grant execute on function private.inventory_can_access(uuid) to authenticated;
grant execute on function private.inventory_can_write(uuid) to authenticated;

create table if not exists public.inventory_apparatus_profiles (
  id uuid primary key references public.department_apparatus(id) on delete restrict,
  department_id uuid not null references public.departments(id) on delete restrict,
  name text not null,
  asset_type text not null,
  vin text,
  manufacturer text,
  model text,
  year integer check (year is null or year between 1900 and 2100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (department_id, id)
);

create table if not exists public.inventory_compartments (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments(id) on delete restrict,
  apparatus_id uuid not null references public.inventory_apparatus_profiles(id) on delete restrict,
  label text not null,
  side text not null check (side in ('driver','officer','front','rear','cab','pump','roof','interior','spin')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (apparatus_id, label)
);

create table if not exists public.inventory_equipment (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments(id) on delete restrict,
  apparatus_id uuid not null references public.inventory_apparatus_profiles(id) on delete restrict,
  compartment_id uuid not null references public.inventory_compartments(id) on delete restrict,
  name text not null,
  manufacturer text,
  model text,
  serial_number text,
  barcode text,
  quantity_required integer not null default 1 check (quantity_required > 0),
  created_at timestamptz not null default now(),
  unique (department_id, barcode)
);

create table if not exists public.inventory_checks (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments(id) on delete restrict,
  apparatus_id uuid not null references public.inventory_apparatus_profiles(id) on delete restrict,
  shift_id text,
  status text not null default 'in_progress' check (status in ('in_progress','completed','cancelled')),
  started_by text not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.inventory_check_items (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments(id) on delete restrict,
  check_id uuid not null references public.inventory_checks(id) on delete restrict,
  equipment_id uuid not null references public.inventory_equipment(id) on delete restrict,
  result text not null default 'pending' check (result in ('pending','pass','missing','damaged','not_applicable')),
  notes text,
  checked_by text,
  checked_at timestamptz,
  unique (check_id, equipment_id)
);

create table if not exists public.inventory_readiness_exceptions (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments(id) on delete restrict,
  apparatus_id uuid not null references public.inventory_apparatus_profiles(id) on delete restrict,
  equipment_id uuid references public.inventory_equipment(id) on delete restrict,
  check_item_id uuid references public.inventory_check_items(id) on delete restrict,
  result text not null,
  priority text not null default 'medium',
  notes text,
  status text not null default 'open',
  out_of_service boolean not null default false,
  opened_by text not null,
  opened_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists public.inventory_work_orders (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments(id) on delete restrict,
  apparatus_id uuid not null references public.inventory_apparatus_profiles(id) on delete restrict,
  equipment_id uuid references public.inventory_equipment(id) on delete restrict,
  status text not null default 'open',
  priority text not null default 'routine',
  summary text not null,
  details text,
  assigned_to text,
  opened_by text not null,
  opened_at timestamptz not null default now(),
  due_at timestamptz,
  closed_at timestamptz
);

create table if not exists public.inventory_stock_items (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments(id) on delete restrict,
  name text not null,
  sku text,
  barcode text,
  unit text not null,
  par_level integer not null default 0,
  reorder_point integer not null default 0,
  expiration_tracked boolean not null default false,
  created_at timestamptz not null default now(),
  unique (department_id, sku),
  unique (department_id, barcode)
);

create table if not exists public.inventory_stock_lots (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments(id) on delete restrict,
  stock_item_id uuid not null references public.inventory_stock_items(id) on delete restrict,
  location_type text not null default 'station',
  location_id text not null,
  lot_number text,
  expires_at date,
  quantity_on_hand integer not null default 0 check (quantity_on_hand >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.inventory_transactions (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments(id) on delete restrict,
  stock_item_id uuid not null references public.inventory_stock_items(id) on delete restrict,
  stock_lot_id uuid references public.inventory_stock_lots(id) on delete restrict,
  transaction_type text not null,
  quantity integer not null,
  to_location_id text,
  reason text not null,
  performed_by uuid not null references auth.users(id) on delete restrict,
  performed_at timestamptz not null default now()
);

create table if not exists public.inventory_photo_views (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments(id) on delete restrict,
  apparatus_id uuid not null references public.inventory_apparatus_profiles(id) on delete restrict,
  compartment_id uuid references public.inventory_compartments(id) on delete restrict,
  equipment_id uuid references public.inventory_equipment(id) on delete restrict,
  view_key text not null,
  view_level text not null default 'exterior',
  door_state text not null default 'not_applicable',
  angle_degrees integer,
  object_key text not null unique,
  original_filename text not null,
  mime_type text not null,
  byte_size bigint not null check (byte_size > 0 and byte_size <= 20971520),
  version_number integer not null default 1,
  approval_status text not null default 'pending',
  paired_view_id uuid references public.inventory_photo_views(id) on delete restrict,
  captured_at timestamptz not null default now(),
  captured_by text not null,
  approved_at timestamptz,
  approved_by uuid references auth.users(id) on delete restrict,
  replaced_at timestamptz
);

create table if not exists public.inventory_photo_hotspots (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments(id) on delete restrict,
  apparatus_id uuid not null references public.inventory_apparatus_profiles(id) on delete restrict,
  photo_view_id uuid not null references public.inventory_photo_views(id) on delete restrict,
  compartment_id uuid not null references public.inventory_compartments(id) on delete restrict,
  label text not null,
  x_basis_points integer not null check (x_basis_points between 0 and 10000),
  y_basis_points integer not null check (y_basis_points between 0 and 10000),
  display_order integer not null default 0,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.inventory_audit_events (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments(id) on delete restrict,
  actor_id uuid not null references auth.users(id) on delete restrict,
  actor_email text not null,
  action text not null,
  aggregate_type text not null,
  aggregate_id text not null,
  next_json jsonb not null default '{}'::jsonb,
  source_device text,
  created_at timestamptz not null default now()
);

create index if not exists inventory_profiles_department_idx on public.inventory_apparatus_profiles(department_id);
create index if not exists inventory_compartments_apparatus_idx on public.inventory_compartments(department_id, apparatus_id, sort_order);
create index if not exists inventory_equipment_apparatus_idx on public.inventory_equipment(department_id, apparatus_id, compartment_id);
create index if not exists inventory_checks_apparatus_idx on public.inventory_checks(department_id, apparatus_id, started_at desc);
create index if not exists inventory_check_items_check_idx on public.inventory_check_items(department_id, check_id);
create index if not exists inventory_exceptions_open_idx on public.inventory_readiness_exceptions(department_id, status, opened_at desc);
create index if not exists inventory_work_orders_open_idx on public.inventory_work_orders(department_id, status, opened_at desc);
create index if not exists inventory_stock_items_department_idx on public.inventory_stock_items(department_id, name);
create index if not exists inventory_stock_lots_item_idx on public.inventory_stock_lots(department_id, stock_item_id);
create index if not exists inventory_transactions_item_idx on public.inventory_transactions(department_id, stock_item_id, performed_at desc);
create index if not exists inventory_photo_views_apparatus_idx on public.inventory_photo_views(department_id, apparatus_id, view_key, door_state, version_number desc);
create index if not exists inventory_hotspots_photo_idx on public.inventory_photo_hotspots(department_id, photo_view_id, display_order);
create index if not exists inventory_audit_department_idx on public.inventory_audit_events(department_id, created_at desc);

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'inventory_apparatus_profiles',
    'inventory_compartments',
    'inventory_equipment',
    'inventory_checks',
    'inventory_check_items',
    'inventory_readiness_exceptions',
    'inventory_work_orders',
    'inventory_stock_items',
    'inventory_stock_lots',
    'inventory_transactions',
    'inventory_photo_views',
    'inventory_photo_hotspots',
    'inventory_audit_events'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_select', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_insert', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_update', table_name);
    execute format(
      'create policy %I on public.%I for select to authenticated using (private.inventory_can_access(department_id))',
      table_name || '_select',
      table_name
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (private.inventory_can_write(department_id))',
      table_name || '_insert',
      table_name
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using (private.inventory_can_write(department_id)) with check (private.inventory_can_write(department_id))',
      table_name || '_update',
      table_name
    );
    execute format('grant select, insert, update on public.%I to authenticated', table_name);
  end loop;
end
$$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'stickney-inventory-media',
  'stickney-inventory-media',
  false,
  20971520,
  array['image/jpeg','image/png','image/webp','image/heic','image/heif']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "stickney_inventory_media_select" on storage.objects;
drop policy if exists "stickney_inventory_media_insert" on storage.objects;
drop policy if exists "stickney_inventory_media_update" on storage.objects;
drop policy if exists "stickney_inventory_media_delete" on storage.objects;

create policy "stickney_inventory_media_select"
on storage.objects for select to authenticated
using (
  bucket_id = 'stickney-inventory-media'
  and private.inventory_can_access(((storage.foldername(name))[1])::uuid)
);

create policy "stickney_inventory_media_insert"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'stickney-inventory-media'
  and private.inventory_can_write(((storage.foldername(name))[1])::uuid)
);

create policy "stickney_inventory_media_update"
on storage.objects for update to authenticated
using (
  bucket_id = 'stickney-inventory-media'
  and private.inventory_can_write(((storage.foldername(name))[1])::uuid)
)
with check (
  bucket_id = 'stickney-inventory-media'
  and private.inventory_can_write(((storage.foldername(name))[1])::uuid)
);

create policy "stickney_inventory_media_delete"
on storage.objects for delete to authenticated
using (
  bucket_id = 'stickney-inventory-media'
  and private.inventory_can_write(((storage.foldername(name))[1])::uuid)
);
