do $$
declare
  stickney_id uuid;
  ambulance_1205_id uuid;
begin
  select id into stickney_id
  from public.departments
  where name = 'Stickney Fire Department'
  limit 1;

  select id into ambulance_1205_id
  from public.inventory_apparatus_profiles
  where department_id = stickney_id and name = '1205'
  limit 1;

  if stickney_id is null or ambulance_1205_id is null then
    raise exception 'Stickney Fire Department apparatus 1205 must exist before loading daily form 265';
  end if;

  insert into public.inventory_compartments
    (department_id, apparatus_id, label, side, sort_order)
  values
    (stickney_id, ambulance_1205_id, 'Cab', 'cab', 100),
    (stickney_id, ambulance_1205_id, 'Engine Compartment', 'front', 110),
    (stickney_id, ambulance_1205_id, 'Oxygen', 'interior', 120),
    (stickney_id, ambulance_1205_id, 'Lights & Electrical', 'front', 130),
    (stickney_id, ambulance_1205_id, 'Cot', 'interior', 140),
    (stickney_id, ambulance_1205_id, 'SCBA', 'cab', 150),
    (stickney_id, ambulance_1205_id, 'Miscellaneous', 'interior', 160)
  on conflict (apparatus_id, label) do update
  set side = excluded.side,
      sort_order = excluded.sort_order;

  with source_items(section_label, item_name, quantity_required, equipment_category, check_types, source_key, item_order) as (
    values
      ('Cab','Fuel - fill at 3/4',1,'vehicle',array['daily'],'form-265-001',1),
      ('Cab','Record miles',1,'vehicle',array['daily'],'form-265-002',2),
      ('Cab','Knox Box keys',1,'equipment',array['daily'],'form-265-003',3),
      ('Cab','Resource books',1,'equipment',array['daily'],'form-265-004',4),
      ('Cab','Clipboard - stocked',1,'equipment',array['daily'],'form-265-005',5),
      ('Cab','Mobile radio',1,'equipment',array['daily'],'form-265-006',6),
      ('Cab','Portable radios',2,'equipment',array['daily'],'form-265-007',7),
      ('Cab','Toughbook / tablet / printer',1,'equipment',array['daily'],'form-265-008',8),
      ('Cab','Perform morning ambulance / engine medication checklist',1,'equipment',array['daily'],'form-265-009',9),
      ('Engine Compartment','Engine oil',1,'vehicle',array['daily'],'form-265-010',1),
      ('Engine Compartment','Transmission fluid - engine running and in neutral',1,'vehicle',array['daily'],'form-265-011',2),
      ('Engine Compartment','Coolant fluid',1,'vehicle',array['daily'],'form-265-012',3),
      ('Engine Compartment','Washer fluid',1,'vehicle',array['daily'],'form-265-013',4),
      ('Engine Compartment','Power steering fluid',1,'vehicle',array['daily'],'form-265-014',5),
      ('Engine Compartment','Engine belts condition',1,'vehicle',array['daily'],'form-265-015',6),
      ('Engine Compartment','Battery connections',1,'vehicle',array['daily'],'form-265-016',7),
      ('Engine Compartment','Brake fluid',1,'vehicle',array['daily'],'form-265-017',8),
      ('Oxygen','On-board oxygen PSI - replace at 500 PSI',1,'equipment',array['daily'],'form-265-018',1),
      ('Oxygen','Oxygen bag PSI - replace at 500 PSI',1,'equipment',array['daily'],'form-265-019',2),
      ('Lights & Electrical','Head lights',1,'vehicle',array['daily'],'form-265-020',1),
      ('Lights & Electrical','Brake lights',1,'vehicle',array['daily'],'form-265-021',2),
      ('Lights & Electrical','Horn',1,'vehicle',array['daily'],'form-265-022',3),
      ('Lights & Electrical','Emergency lights',1,'vehicle',array['daily'],'form-265-023',4),
      ('Lights & Electrical','Backup light',1,'vehicle',array['daily'],'form-265-024',5),
      ('Lights & Electrical','Turn signals',1,'vehicle',array['daily'],'form-265-025',6),
      ('Lights & Electrical','Scene lights',1,'vehicle',array['daily'],'form-265-026',7),
      ('Lights & Electrical','Wipers',1,'vehicle',array['daily'],'form-265-027',8),
      ('Lights & Electrical','Siren',1,'vehicle',array['daily'],'form-265-028',9),
      ('Cot','Cot battery charged',1,'equipment',array['daily'],'form-265-029',1),
      ('Cot','Cot made with spare sheets and blankets',1,'equipment',array['daily'],'form-265-030',2),
      ('SCBA','Driver SCBA PSI',1,'air_pack',array['daily'],'form-265-031',1),
      ('SCBA','Passenger SCBA PSI',1,'air_pack',array['daily'],'form-265-032',2),
      ('Miscellaneous','Visually inspect all equipment - jump bag, stairchair, backboards, rope bag and related equipment',1,'equipment',array['daily'],'form-265-033',1),
      ('Miscellaneous','Any issues found',1,'equipment',array['daily'],'form-265-034',2)
  )
  insert into public.inventory_equipment
    (department_id, apparatus_id, compartment_id, name, quantity_required,
     equipment_category, check_types, source_key, source_form, item_order)
  select
    stickney_id,
    ambulance_1205_id,
    c.id,
    source_items.item_name,
    source_items.quantity_required,
    source_items.equipment_category,
    source_items.check_types,
    source_items.source_key,
    '1205 Daily Check form 265',
    source_items.item_order
  from source_items
  join public.inventory_compartments c
    on c.department_id = stickney_id
   and c.apparatus_id = ambulance_1205_id
   and c.label = source_items.section_label
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
