do $$
declare
  stickney_id uuid;
  utility_1208_id uuid;
begin
  select id into stickney_id
  from public.departments
  where name = 'Stickney Fire Department'
  limit 1;

  select id into utility_1208_id
  from public.inventory_apparatus_profiles
  where department_id = stickney_id and name = '1208'
  limit 1;

  if stickney_id is null or utility_1208_id is null then
    raise exception 'Stickney Fire Department apparatus 1208 must exist before loading daily form 266';
  end if;

  insert into public.inventory_compartments
    (department_id, apparatus_id, label, side, sort_order)
  values
    (stickney_id, utility_1208_id, 'Cab', 'cab', 100),
    (stickney_id, utility_1208_id, 'Engine Compartment', 'front', 110),
    (stickney_id, utility_1208_id, 'Lights & Electrical', 'front', 120),
    (stickney_id, utility_1208_id, 'SCBA', 'cab', 130)
  on conflict (apparatus_id, label) do update
  set side = excluded.side,
      sort_order = excluded.sort_order;

  with source_items(section_label, item_name, quantity_required, equipment_category, check_types, source_key, item_order) as (
    values
      ('Cab','Fuel - fill at 3/4',1,'vehicle',array['daily'],'form-266-001',1),
      ('Cab','Record mileage',1,'vehicle',array['daily'],'form-266-002',2),
      ('Cab','Mobile radio',1,'equipment',array['daily'],'form-266-003',3),
      ('Cab','Set of irons',1,'equipment',array['daily'],'form-266-004',4),
      ('Cab','Knox Box keys',1,'equipment',array['daily'],'form-266-005',5),
      ('Cab','Box light',1,'equipment',array['daily'],'form-266-006',6),
      ('Engine Compartment','Engine oil',1,'vehicle',array['daily'],'form-266-007',1),
      ('Engine Compartment','Antifreeze / coolant level',1,'vehicle',array['daily'],'form-266-008',2),
      ('Engine Compartment','Washer fluid',1,'vehicle',array['daily'],'form-266-009',3),
      ('Engine Compartment','Power steering fluid',1,'vehicle',array['daily'],'form-266-010',4),
      ('Engine Compartment','Engine belts condition',1,'vehicle',array['daily'],'form-266-011',5),
      ('Engine Compartment','Battery connections',1,'vehicle',array['daily'],'form-266-012',6),
      ('Engine Compartment','Brake fluid',1,'vehicle',array['daily'],'form-266-013',7),
      ('Lights & Electrical','Head lights',1,'vehicle',array['daily'],'form-266-014',1),
      ('Lights & Electrical','Brake lights',1,'vehicle',array['daily'],'form-266-015',2),
      ('Lights & Electrical','Horn',1,'vehicle',array['daily'],'form-266-016',3),
      ('Lights & Electrical','Emergency lights',1,'vehicle',array['daily'],'form-266-017',4),
      ('Lights & Electrical','Backup light',1,'vehicle',array['daily'],'form-266-018',5),
      ('Lights & Electrical','Turn signals',1,'vehicle',array['daily'],'form-266-019',6),
      ('Lights & Electrical','Wipers',1,'vehicle',array['daily'],'form-266-020',7),
      ('Lights & Electrical','Siren',1,'vehicle',array['daily'],'form-266-021',8),
      ('SCBA','Driver SCBA PSI',1,'air_pack',array['daily'],'form-266-022',1)
  )
  insert into public.inventory_equipment
    (department_id, apparatus_id, compartment_id, name, quantity_required,
     equipment_category, check_types, source_key, source_form, item_order)
  select
    stickney_id,
    utility_1208_id,
    c.id,
    source_items.item_name,
    source_items.quantity_required,
    source_items.equipment_category,
    source_items.check_types,
    source_items.source_key,
    '1208 Daily Check form 266',
    source_items.item_order
  from source_items
  join public.inventory_compartments c
    on c.department_id = stickney_id
   and c.apparatus_id = utility_1208_id
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
