alter table public.inventory_equipment
  add column if not exists item_type text not null default 'individual',
  add column if not exists parent_equipment_id uuid references public.inventory_equipment(id) on delete restrict,
  add column if not exists purchase_date date,
  add column if not exists in_service_date date,
  add column if not exists expiration_date date,
  add column if not exists response_type text not null default 'pass_fail',
  add column if not exists service_status text not null default 'in_service',
  add column if not exists service_notes text,
  add column if not exists retirement_reason text,
  add column if not exists retired_by text,
  add column if not exists updated_at timestamptz not null default now();

alter table public.inventory_equipment
  drop constraint if exists inventory_equipment_item_type_check,
  add constraint inventory_equipment_item_type_check
    check (item_type in ('individual', 'kit', 'bag', 'toolbox', 'container', 'consumable')),
  drop constraint if exists inventory_equipment_response_type_check,
  add constraint inventory_equipment_response_type_check
    check (response_type in ('pass_fail', 'quantity', 'expiration_date', 'numeric', 'mileage', 'text')),
  drop constraint if exists inventory_equipment_service_status_check,
  add constraint inventory_equipment_service_status_check
    check (service_status in ('in_service', 'out_of_service', 'in_repair', 'retired')),
  drop constraint if exists inventory_equipment_parent_not_self_check,
  add constraint inventory_equipment_parent_not_self_check
    check (parent_equipment_id is null or parent_equipment_id <> id);

create index if not exists inventory_equipment_parent_idx
  on public.inventory_equipment(department_id, parent_equipment_id)
  where parent_equipment_id is not null and retired_at is null;

create index if not exists inventory_equipment_lifecycle_idx
  on public.inventory_equipment(department_id, service_status, expiration_date)
  where retired_at is null;

alter table public.inventory_checks
  add column if not exists review_status text not null default 'approved',
  add column if not exists reviewed_by text,
  add column if not exists reviewed_at timestamptz,
  add column if not exists review_notes text;

alter table public.inventory_checks
  drop constraint if exists inventory_checks_review_status_check,
  add constraint inventory_checks_review_status_check
    check (review_status in ('pending', 'approved', 'changes_requested'));

alter table public.inventory_checks
  alter column review_status set default 'pending';

create index if not exists inventory_checks_review_queue_idx
  on public.inventory_checks(department_id, review_status, completed_at desc)
  where status = 'completed';
