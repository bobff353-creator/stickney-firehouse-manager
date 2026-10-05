-- Additive receipts: retries preserve the original audit, quantity and linked IDs.
create table public.inventory_operation_receipts (
  department_id uuid not null references public.departments(id),
  request_id uuid not null,
  actor_id uuid not null,
  action text not null,
  input jsonb not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key (department_id, request_id)
);
alter table public.inventory_operation_receipts enable row level security;
revoke all on public.inventory_operation_receipts from anon;
grant select, insert on public.inventory_operation_receipts to authenticated;
create policy inventory_receipts_read on public.inventory_operation_receipts for select to authenticated
  using (actor_id = (select auth.uid()) and private.inventory_can_access(department_id));
create policy inventory_receipts_insert on public.inventory_operation_receipts for insert to authenticated
  with check (actor_id = (select auth.uid()) and private.inventory_can_write(department_id));
-- Same server boundary as the existing department inventory tables.
create policy portal_server_boundary on public.inventory_operation_receipts as restrictive to authenticated
  using (department_id <> '14a76771-4c24-481b-8def-e6cce005c17b'::uuid or (select private.portal_server_request()))
  with check (department_id <> '14a76771-4c24-481b-8def-e6cce005c17b'::uuid or (select private.portal_server_request()));
create index inventory_operation_receipts_actor_idx on public.inventory_operation_receipts(actor_id, created_at desc);

create function public.inventory_apply_operation(p_department_id uuid, p_request_id uuid, p_action text, p_input jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  saved public.inventory_operation_receipts%rowtype;
  lot public.inventory_stock_lots%rowtype;
  work public.inventory_work_orders%rowtype;
  equipment public.inventory_equipment%rowtype;
  apparatus public.inventory_apparatus_profiles%rowtype;
  actor text := coalesce(auth.jwt()->>'email', auth.uid()::text);
  result jsonb;
  delta integer;
  next_quantity bigint;
  order_id uuid := gen_random_uuid();
  exception_id uuid := gen_random_uuid();
  v_apparatus_id uuid;
  v_equipment_id uuid;
  photo_id uuid;
  categories text[];
  assigned_ids text[];
  assigned_names text[];
  cost numeric;
  v_repair_date date;
  v_service_type text := coalesce(nullif(p_input->>'serviceType',''),'repair');
begin
  if auth.uid() is null or not private.inventory_can_write(p_department_id) then
    raise exception 'Inventory permission required.' using errcode='42501';
  end if;
  if p_action not in ('adjust_stock','create_notice','create_work_order','close_work_order','update_work_order_status') then
    raise exception 'Unsupported operation.' using errcode='22023';
  end if;
  if not private.portal_has_permission(case when p_action='adjust_stock' then 'inventory.check' else 'inventory.repairs.manage' end) then
    raise exception 'Permission for this operation is required.' using errcode='42501';
  end if;
  if p_request_id is null or p_input is null or jsonb_typeof(p_input) <> 'object' then
    raise exception 'A save reference and operation details are required.' using errcode='22023';
  end if;
  -- Serialize a single retry key before reading it. Different stock saves still
  -- serialize on their actual lot, so concurrent changes cannot overwrite counts.
  perform pg_advisory_xact_lock(hashtextextended(p_department_id::text || p_request_id::text,0));
  select * into saved from public.inventory_operation_receipts
    where department_id=p_department_id and request_id=p_request_id;
  if found then
    if saved.actor_id <> auth.uid() or saved.action <> p_action or saved.input <> p_input then
      raise exception 'This save reference belongs to different details. Refresh before saving.' using errcode='40001';
    end if;
    return saved.result || jsonb_build_object('replayed',true);
  end if;
  if p_action='adjust_stock' then
    if coalesce(p_input->>'delta','') !~ '^-?[0-9]+$' or nullif(btrim(p_input->>'reason'),'') is null then
      raise exception 'Enter a whole non-zero adjustment and its reason.' using errcode='22023';
    end if;
    delta := (p_input->>'delta')::integer;
    if delta=0 then raise exception 'Enter a non-zero adjustment.' using errcode='22023'; end if;
    select * into lot from public.inventory_stock_lots
      where department_id=p_department_id and id=(p_input->>'lotId')::uuid for update;
    if not found then raise exception 'Supply lot not found in this department.' using errcode='P0002'; end if;
    next_quantity := lot.quantity_on_hand::bigint+delta;
    if next_quantity < 0 or next_quantity > 2147483647 then
      raise exception 'Adjustment exceeds the saved quantity or supported limit. Refresh the lot.' using errcode='22023';
    end if;
    update public.inventory_stock_lots set quantity_on_hand=next_quantity::integer
      where department_id=p_department_id and id=lot.id;
    insert into public.inventory_transactions(department_id,stock_item_id,stock_lot_id,transaction_type,quantity,to_location_id,reason,performed_by)
      values(p_department_id,lot.stock_item_id,lot.id,case when delta>0 then 'receive' else 'use' end,delta,lot.location_id,left(btrim(p_input->>'reason'),300),auth.uid());
    result := jsonb_build_object('quantityOnHand',next_quantity,'lotId',lot.id);
  elsif p_action in ('create_notice','create_work_order') then
    v_apparatus_id := (p_input->>'apparatusId')::uuid;
    v_equipment_id := nullif(p_input->>'equipmentId','')::uuid;
    select * into apparatus from public.inventory_apparatus_profiles where department_id=p_department_id and id=v_apparatus_id;
    if not found then raise exception 'Apparatus not found in this department.' using errcode='P0002'; end if;
    if v_equipment_id is not null then
      select * into equipment from public.inventory_equipment where department_id=p_department_id and id=v_equipment_id and apparatus_id=apparatus.id and retired_at is null for update;
      if not found then raise exception 'Active equipment not found on this apparatus.' using errcode='P0002'; end if;
    end if;
    select coalesce(array_agg(value),array[]::text[]) into assigned_ids from jsonb_array_elements_text(coalesce(p_input->'assignedEmployeeIds','[]'::jsonb));
    select coalesce(array_agg(value),array[]::text[]) into assigned_names from jsonb_array_elements_text(coalesce(p_input->'assignedEmployeeNames','[]'::jsonb));
    if p_action='create_notice' then
      select coalesce(array_agg(value),array[]::text[]) into categories from jsonb_array_elements_text(coalesce(p_input->'issueCategories','[]'::jsonb));
      if nullif(btrim(p_input->>'notes'),'') is null or cardinality(categories)=0 or cardinality(assigned_ids)=0 or not categories <@ array['vehicle','air_pack','equipment'] then
        raise exception 'Select an issue type, assignee and notice details.' using errcode='22023';
      end if;
      photo_id := nullif(p_input->>'evidencePhotoId','')::uuid;
      if photo_id is not null and not exists(select 1 from public.inventory_deficiency_photos where department_id=p_department_id and apparatus_id=apparatus.id and id=photo_id) then
        raise exception 'Photo does not match this apparatus.' using errcode='22023';
      end if;
      insert into public.inventory_readiness_exceptions(id,department_id,apparatus_id,result,priority,notes,status,out_of_service,opened_by,issue_categories,assigned_employee_ids,assigned_employee_names,evidence_photo_id)
        values(exception_id,p_department_id,apparatus.id,'failed',coalesce(nullif(p_input->>'priority',''),'medium'),left(btrim(p_input->>'notes'),1000),'open',false,actor,categories,assigned_ids,assigned_names,photo_id);
      insert into public.inventory_work_orders(id,department_id,apparatus_id,linked_exception_id,status,priority,summary,details,assigned_to,assigned_employee_ids,assigned_employee_names,opened_by)
        values(order_id,p_department_id,apparatus.id,exception_id,'new',coalesce(nullif(p_input->>'priority',''),'medium'),apparatus.name || ' ' || array_to_string(categories,' / ') || ' notice',left(btrim(p_input->>'notes'),1000),array_to_string(assigned_names,', '),assigned_ids,assigned_names,actor);
      result := jsonb_build_object('noticeId',exception_id,'workOrderId',order_id);
    else
      if nullif(btrim(p_input->>'summary'),'') is null or v_service_type not in ('inspection','preventive','repair','recall','tires','fluids','electrical','body','other') or coalesce(nullif(p_input->>'odometer','')::integer,0)<0 then
        raise exception 'Enter work details, a valid service type and nonnegative mileage.' using errcode='22023';
      end if;
      insert into public.inventory_work_orders(id,department_id,apparatus_id,equipment_id,status,priority,summary,details,assigned_to,assigned_employee_ids,assigned_employee_names,opened_by,service_type,odometer)
        values(order_id,p_department_id,apparatus.id,v_equipment_id,'new',coalesce(nullif(p_input->>'priority',''),'routine'),left(btrim(p_input->>'summary'),240),left(p_input->>'details',1000),coalesce(nullif(array_to_string(assigned_names,', '),''),nullif(p_input->>'assignedTo','')),assigned_ids,assigned_names,actor,v_service_type,nullif(p_input->>'odometer','')::integer);
      if v_equipment_id is not null then
        update public.inventory_equipment set service_status='in_repair',updated_at=now()
          where department_id=p_department_id and id=v_equipment_id and service_status='in_service';
      end if;
      result := jsonb_build_object('workOrder',jsonb_build_object('id',order_id));
    end if;
  else
    select * into work from public.inventory_work_orders where department_id=p_department_id and id=(p_input->>'workOrderId')::uuid for update;
    if not found then raise exception 'Work order not found in this department.' using errcode='P0002'; end if;
    if work.status in ('closed','completed','cancelled') then
      raise exception 'This repair is no longer open. Refresh its saved history.' using errcode='40001';
    end if;
    if p_action='update_work_order_status' then
      if coalesce(p_input->>'status','') not in ('new','assigned','in_repair','waiting_parts') then
        raise exception 'Choose a valid repair stage.' using errcode='22023';
      end if;
      if nullif(p_input->>'expectedStatus','') is not null and work.status <> p_input->>'expectedStatus' then
        raise exception 'Repair stage changed since you opened it. Refresh before saving.' using errcode='40001';
      end if;
      update public.inventory_work_orders set status=p_input->>'status' where department_id=p_department_id and id=work.id;
      result := jsonb_build_object('updated',true);
    else
      cost := nullif(p_input->>'repairCost','')::numeric;
      v_repair_date := nullif(p_input->>'repairDate','')::date;
      if cost is null or cost < 0 or cost::text in ('NaN','Infinity','-Infinity') or v_repair_date is null or nullif(btrim(p_input->>'resolutionNotes'),'') is null or v_service_type not in ('inspection','preventive','repair','recall','tires','fluids','electrical','body','other') or coalesce(nullif(p_input->>'odometer','')::integer,0)<0 or coalesce(nullif(p_input->>'laborHours','')::numeric,0)<0 or coalesce(nullif(p_input->>'laborHours','')::numeric,0)::text in ('NaN','Infinity','-Infinity') or coalesce(nullif(p_input->>'nextServiceDueMileage','')::integer,0)<0 then
        raise exception 'Repair date, resolution, valid cost and nonnegative service readings are required.' using errcode='22023';
      end if;
      update public.inventory_work_orders set status='closed',closed_at=now(),repair_date=v_repair_date,repair_cost=cost,
        vendor=nullif(left(p_input->>'vendor',240),''),invoice_number=nullif(left(p_input->>'invoiceNumber',120),''),resolution_notes=left(btrim(p_input->>'resolutionNotes'),1000),closed_by=actor,
        service_type=v_service_type,odometer=nullif(p_input->>'odometer','')::integer,labor_hours=nullif(p_input->>'laborHours','')::numeric,
        performed_by=coalesce(nullif(left(p_input->>'performedBy',240),''),nullif(left(p_input->>'vendor',240),'')),parts_used=nullif(left(p_input->>'partsUsed',2000),''),next_service_due_date=nullif(p_input->>'nextServiceDueDate','')::date,next_service_due_mileage=nullif(p_input->>'nextServiceDueMileage','')::integer
        where department_id=p_department_id and id=work.id;
      if work.linked_exception_id is not null and not exists(select 1 from public.inventory_work_orders where department_id=p_department_id and linked_exception_id=work.linked_exception_id and id<>work.id and status not in ('closed','completed','cancelled')) then
        update public.inventory_readiness_exceptions set status='resolved',resolved_at=now(),resolved_by=actor,resolution_notes=left(btrim(p_input->>'resolutionNotes'),1000)
          where department_id=p_department_id and id=work.linked_exception_id and status <> 'resolved';
      end if;
      -- Completion is historical evidence, not an equipment release to service.
      -- Keep its saved service status and every other unresolved defect intact.
      result := jsonb_build_object('closed',true,'serviceStatusRequiresReview',work.equipment_id is not null);
    end if;
  end if;
  result := result || jsonb_build_object('requestId',p_request_id);
  insert into public.inventory_operation_receipts(department_id,request_id,actor_id,action,input,result)
    values(p_department_id,p_request_id,auth.uid(),p_action,p_input,result);
  return result;
end;
$$;
revoke all on function public.inventory_apply_operation(uuid,uuid,text,jsonb) from public,anon;
grant execute on function public.inventory_apply_operation(uuid,uuid,text,jsonb) to authenticated;
