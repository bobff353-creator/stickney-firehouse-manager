create or replace function private.inventory_can_admin(target_department_id uuid)
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
        and membership.role in ('admin', 'chief')
    );
$$;

revoke all on function private.inventory_can_admin(uuid) from public;
grant execute on function private.inventory_can_admin(uuid) to authenticated;

create table if not exists public.inventory_location_change_requests (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments(id) on delete restrict,
  equipment_id uuid not null references public.inventory_equipment(id) on delete restrict,
  check_item_id uuid references public.inventory_check_items(id) on delete restrict,
  from_apparatus_id uuid not null references public.inventory_apparatus_profiles(id) on delete restrict,
  from_compartment_id uuid not null references public.inventory_compartments(id) on delete restrict,
  proposed_apparatus_id uuid not null references public.inventory_apparatus_profiles(id) on delete restrict,
  proposed_compartment_id uuid not null references public.inventory_compartments(id) on delete restrict,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'denied')),
  request_notes text,
  requested_by uuid not null references auth.users(id) on delete restrict,
  requested_by_email text not null,
  requested_at timestamptz not null default now(),
  reviewed_by uuid references auth.users(id) on delete restrict,
  reviewed_by_email text,
  reviewed_at timestamptz,
  review_notes text,
  check (
    (status = 'pending' and reviewed_by is null and reviewed_at is null)
    or (status in ('approved', 'denied') and reviewed_by is not null and reviewed_at is not null)
  )
);

create unique index if not exists inventory_location_change_one_pending_per_equipment_idx
  on public.inventory_location_change_requests(department_id, equipment_id)
  where status = 'pending';

create index if not exists inventory_location_change_review_queue_idx
  on public.inventory_location_change_requests(department_id, status, requested_at desc);

create index if not exists inventory_location_change_check_item_idx
  on public.inventory_location_change_requests(department_id, check_item_id)
  where check_item_id is not null;

alter table public.inventory_location_change_requests enable row level security;

drop policy if exists inventory_location_change_requests_select
  on public.inventory_location_change_requests;
create policy inventory_location_change_requests_select
  on public.inventory_location_change_requests
  for select to authenticated
  using (private.inventory_can_access(department_id));

drop policy if exists inventory_location_change_requests_insert
  on public.inventory_location_change_requests;
create policy inventory_location_change_requests_insert
  on public.inventory_location_change_requests
  for insert to authenticated
  with check (
    private.inventory_can_write(department_id)
    and requested_by = (select auth.uid())
    and status = 'pending'
  );

drop policy if exists inventory_location_change_requests_update
  on public.inventory_location_change_requests;
create policy inventory_location_change_requests_update
  on public.inventory_location_change_requests
  for update to authenticated
  using (private.inventory_can_admin(department_id))
  with check (private.inventory_can_admin(department_id));

revoke all on public.inventory_location_change_requests from public, anon;
grant select, insert, update on public.inventory_location_change_requests to authenticated;

create or replace function private.apply_inventory_location_change()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_compartment record;
  moved_rows integer;
begin
  if old.status <> 'pending' then
    raise exception 'This location request has already been reviewed.';
  end if;

  if new.department_id <> old.department_id
    or new.equipment_id <> old.equipment_id
    or new.check_item_id is distinct from old.check_item_id
    or new.from_apparatus_id <> old.from_apparatus_id
    or new.from_compartment_id <> old.from_compartment_id
    or new.proposed_apparatus_id <> old.proposed_apparatus_id
    or new.proposed_compartment_id <> old.proposed_compartment_id
    or new.requested_by <> old.requested_by
    or new.requested_by_email <> old.requested_by_email
    or new.requested_at <> old.requested_at
  then
    raise exception 'Submitted location details cannot be changed during review.';
  end if;

  if new.status not in ('approved', 'denied') then
    raise exception 'Choose approved or denied.';
  end if;

  if not private.inventory_can_admin(old.department_id) then
    raise exception 'Administrator approval is required.';
  end if;

  select compartment.id, compartment.apparatus_id
    into target_compartment
  from public.inventory_compartments as compartment
  where compartment.department_id = old.department_id
    and compartment.id = old.proposed_compartment_id
    and compartment.apparatus_id = old.proposed_apparatus_id;

  if target_compartment.id is null then
    raise exception 'The proposed compartment is not available for that apparatus.';
  end if;

  new.reviewed_by := (select auth.uid());
  new.reviewed_by_email := coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email',
    new.reviewed_by_email,
    'authenticated administrator'
  );
  new.reviewed_at := now();

  if new.status = 'approved' then
    update public.inventory_equipment
    set apparatus_id = old.proposed_apparatus_id,
        compartment_id = old.proposed_compartment_id
    where department_id = old.department_id
      and id = old.equipment_id
      and apparatus_id = old.from_apparatus_id
      and compartment_id = old.from_compartment_id
      and retired_at is null;

    get diagnostics moved_rows = row_count;
    if moved_rows <> 1 then
      raise exception 'The equipment location changed after this request was submitted. Review the current inventory before approving it.';
    end if;

    if old.from_apparatus_id <> old.proposed_apparatus_id then
      update public.inventory_check_items as item
      set result = 'not_applicable',
          notes = concat_ws(' ', nullif(item.notes, ''), 'Location change approved; item moved to another apparatus.'),
          checked_by = new.reviewed_by_email,
          checked_at = now()
      from public.inventory_checks as check_record
      where item.department_id = old.department_id
        and item.equipment_id = old.equipment_id
        and item.result = 'pending'
        and check_record.id = item.check_id
        and check_record.department_id = old.department_id
        and check_record.apparatus_id = old.from_apparatus_id
        and check_record.check_type = 'inventory'
        and check_record.status = 'in_progress';

      insert into public.inventory_check_items (
        department_id,
        check_id,
        equipment_id,
        result
      )
      select
        old.department_id,
        check_record.id,
        old.equipment_id,
        'pending'
      from public.inventory_checks as check_record
      where check_record.department_id = old.department_id
        and check_record.apparatus_id = old.proposed_apparatus_id
        and check_record.check_type = 'inventory'
        and check_record.status = 'in_progress'
      on conflict (check_id, equipment_id) do nothing;
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.apply_inventory_location_change() from public;

drop trigger if exists inventory_location_change_apply
  on public.inventory_location_change_requests;
create trigger inventory_location_change_apply
before update on public.inventory_location_change_requests
for each row execute function private.apply_inventory_location_change();

create or replace function private.audit_inventory_location_change()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  insert into public.inventory_audit_events (
    department_id,
    actor_id,
    actor_email,
    action,
    aggregate_type,
    aggregate_id,
    next_json
  ) values (
    new.department_id,
    case when tg_op = 'INSERT' then new.requested_by else new.reviewed_by end,
    case when tg_op = 'INSERT' then new.requested_by_email else new.reviewed_by_email end,
    case when tg_op = 'INSERT' then 'location_change_requested' else 'location_change_' || new.status end,
    'inventory_equipment',
    new.equipment_id::text,
    jsonb_build_object(
      'request_id', new.id,
      'status', new.status,
      'from_apparatus_id', new.from_apparatus_id,
      'from_compartment_id', new.from_compartment_id,
      'proposed_apparatus_id', new.proposed_apparatus_id,
      'proposed_compartment_id', new.proposed_compartment_id,
      'review_notes', new.review_notes
    )
  );
  return new;
end;
$$;

revoke all on function private.audit_inventory_location_change() from public;

drop trigger if exists inventory_location_change_audit
  on public.inventory_location_change_requests;
create trigger inventory_location_change_audit
after insert or update on public.inventory_location_change_requests
for each row execute function private.audit_inventory_location_change();

comment on table public.inventory_location_change_requests is
  'Crew-proposed equipment location changes. Approval atomically updates the equipment record and any active apparatus inventory checklists.';
