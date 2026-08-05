do $$
declare
  stickney_id uuid;
  missing_units text;
begin
  select id into stickney_id
  from public.departments
  where name = 'Stickney Fire Department'
  limit 1;

  if stickney_id is null then
    raise exception 'Stickney Fire Department must exist before loading Daily Drug Inventory form 338';
  end if;

  select string_agg(required_unit, ', ' order by required_unit)
  into missing_units
  from unnest(array['1201','1203','1204','1205','1207']) as required_unit
  where not exists (
    select 1
    from public.inventory_apparatus_profiles apparatus
    where apparatus.department_id = stickney_id
      and apparatus.name = required_unit
  );

  if missing_units is not null then
    raise exception 'The following apparatus must exist before loading Daily Drug Inventory form 338: %', missing_units;
  end if;

  with required_locations(apparatus_name, section_label, side, sort_order) as (
    values
      ('1201','Medication - Jump Bag','interior',500),
      ('1203','Medication - Jump Bag','interior',500),
      ('1204','Medication - Jump Bag','interior',500),
      ('1205','Medication - Jump Bag','interior',500),
      ('1205','Medication - Cabinet','interior',510),
      ('1207','Medication - Jump Bag','interior',500),
      ('1207','Medication - Cabinet','interior',510)
  )
  insert into public.inventory_compartments
    (department_id, apparatus_id, label, side, sort_order)
  select
    stickney_id,
    apparatus.id,
    required_locations.section_label,
    required_locations.side,
    required_locations.sort_order
  from required_locations
  join public.inventory_apparatus_profiles apparatus
    on apparatus.department_id = stickney_id
   and apparatus.name = required_locations.apparatus_name
  on conflict (apparatus_id, label) do update
  set side = excluded.side,
      sort_order = excluded.sort_order;

  with required_locations(apparatus_name, section_label, location_key) as (
    values
      ('1201','Medication - Jump Bag','jump'),
      ('1203','Medication - Jump Bag','jump'),
      ('1204','Medication - Jump Bag','jump'),
      ('1205','Medication - Jump Bag','jump'),
      ('1205','Medication - Cabinet','cabinet'),
      ('1207','Medication - Jump Bag','jump'),
      ('1207','Medication - Cabinet','cabinet')
  ), medications(item_name, item_key, jump_quantity, cabinet_quantity, item_order) as (
    values
      ('Albuterol - verify quantity and expiration','albuterol',1,2,1),
      ('Atrovent - verify quantity and expiration','atrovent',1,2,2),
      ('Oral Glucose - verify quantity and expiration','oral-glucose',2,2,3),
      ('Glucagon - verify quantity and expiration','glucagon',1,1,4),
      ('Zofran - verify quantity and expiration','zofran',2,2,5),
      ('Narcan - verify quantity and expiration','narcan',2,2,6),
      ('Epinephrine - verify quantity and expiration','epinephrine',2,2,7),
      ('Aspirin - verify quantity and expiration','aspirin',1,1,8)
  ), source_items as (
    select
      required_locations.apparatus_name,
      required_locations.section_label,
      medications.item_name,
      case
        when required_locations.location_key = 'cabinet' then medications.cabinet_quantity
        else medications.jump_quantity
      end as quantity_required,
      'form-338-' || required_locations.apparatus_name || '-' || required_locations.location_key || '-' || medications.item_key as source_key,
      medications.item_order
    from required_locations
    cross join medications
  )
  insert into public.inventory_equipment
    (department_id, apparatus_id, compartment_id, name, quantity_required,
     equipment_category, check_types, source_key, source_form, item_order)
  select
    stickney_id,
    apparatus.id,
    compartment.id,
    source_items.item_name,
    source_items.quantity_required,
    'equipment',
    array['daily'],
    source_items.source_key,
    'Daily Drug Inventory form 338',
    source_items.item_order
  from source_items
  join public.inventory_apparatus_profiles apparatus
    on apparatus.department_id = stickney_id
   and apparatus.name = source_items.apparatus_name
  join public.inventory_compartments compartment
    on compartment.department_id = stickney_id
   and compartment.apparatus_id = apparatus.id
   and compartment.label = source_items.section_label
  on conflict (department_id, apparatus_id, source_key) where source_key is not null
  do update set
    compartment_id = excluded.compartment_id,
    name = excluded.name,
    quantity_required = excluded.quantity_required,
    equipment_category = excluded.equipment_category,
    check_types = excluded.check_types,
    source_form = excluded.source_form,
    item_order = excluded.item_order,
    retired_at = null;
end $$;
