create or replace view firehouse.stickney_inventory_checks
with (security_invoker = true)
as
select
  c.id::text as id,
  c.apparatus_id::text as apparatus_id,
  c.shift_id,
  c.check_type,
  c.status,
  c.started_by,
  c.started_at,
  c.completed_at
from public.inventory_checks c
where c.department_id = (
  select d.id from public.departments d
  where d.slug = 'stickney-fire-department'
  limit 1
);

create or replace view firehouse.stickney_inventory_check_items
with (security_invoker = true)
as
select
  i.id::text as id,
  i.check_id::text as check_id,
  i.equipment_id::text as equipment_id,
  i.result,
  i.notes,
  i.numeric_reading,
  i.checked_by,
  i.checked_at
from public.inventory_check_items i
where i.department_id = (
  select d.id from public.departments d
  where d.slug = 'stickney-fire-department'
  limit 1
);

create or replace view firehouse.stickney_inventory_readiness_exceptions
with (security_invoker = true)
as
select
  e.id::text as id,
  e.apparatus_id::text as apparatus_id,
  e.equipment_id::text as equipment_id,
  e.check_item_id::text as check_item_id,
  e.result,
  e.priority,
  e.notes,
  e.status,
  e.out_of_service,
  e.opened_by,
  e.opened_at,
  e.issue_categories,
  e.assigned_employee_names,
  e.evidence_photo_id::text as evidence_photo_id,
  e.resolved_at,
  e.resolved_by,
  e.resolution_notes
from public.inventory_readiness_exceptions e
where e.department_id = (
  select d.id from public.departments d
  where d.slug = 'stickney-fire-department'
  limit 1
);

create or replace view firehouse.stickney_inventory_work_orders
with (security_invoker = true)
as
select
  w.id::text as id,
  w.apparatus_id::text as apparatus_id,
  w.equipment_id::text as equipment_id,
  w.status,
  w.priority,
  w.summary,
  w.details,
  w.assigned_to,
  w.opened_by,
  w.opened_at,
  w.due_at,
  w.closed_at,
  w.linked_exception_id::text as linked_exception_id,
  w.assigned_employee_names,
  w.repair_date,
  w.repair_cost,
  w.vendor,
  w.invoice_number,
  w.resolution_notes,
  w.closed_by
from public.inventory_work_orders w
where w.department_id = (
  select d.id from public.departments d
  where d.slug = 'stickney-fire-department'
  limit 1
);

revoke all on firehouse.stickney_inventory_checks from public, anon, authenticated, service_role;
revoke all on firehouse.stickney_inventory_check_items from public, anon, authenticated, service_role;
revoke all on firehouse.stickney_inventory_readiness_exceptions from public, anon, authenticated, service_role;
revoke all on firehouse.stickney_inventory_work_orders from public, anon, authenticated, service_role;

comment on view firehouse.stickney_inventory_checks is
  'Read-only Stickney Fleet check bridge used by the signed PrePlan 360 server connection.';
comment on view firehouse.stickney_inventory_check_items is
  'Read-only Stickney Fleet check-item bridge used by the signed PrePlan 360 server connection.';
comment on view firehouse.stickney_inventory_readiness_exceptions is
  'Read-only Stickney Fleet readiness bridge used by the signed PrePlan 360 server connection.';
comment on view firehouse.stickney_inventory_work_orders is
  'Read-only Stickney Fleet work-order bridge used by the signed PrePlan 360 server connection.';
