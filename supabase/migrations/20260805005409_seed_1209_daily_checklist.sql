do $$
declare
  stickney_id uuid;
  utility_1209_id uuid;
begin
  select id into stickney_id
  from public.departments
  where name = 'Stickney Fire Department'
  limit 1;

  select id into utility_1209_id
  from public.inventory_apparatus_profiles
  where department_id = stickney_id and name = '1209'
  limit 1;

  if stickney_id is null or utility_1209_id is null then
    raise exception 'Stickney Fire Department apparatus 1209 must exist before loading daily form 268';
  end if;

  insert into public.inventory_compartments
    (department_id, apparatus_id, label, side, sort_order)
  values
    (stickney_id, utility_1209_id, 'Cab', 'cab', 100),
    (stickney_id, utility_1209_id, 'Engine Compartment', 'front', 110),
    (stickney_id, utility_1209_id, 'Lights & Electrical', 'front', 120)
  on conflict (apparatus_id, label) do update
  set side = excluded.side,
      sort_order = excluded.sort_order;

  with source_items(section_label, item_name, quantity_required, equipment_category, check_types, source_key, item_order) as (
    values
      ('Cab','Fuel - fill at 3/4',1,'vehicle',array['daily'],'form-268-001',1),
      ('Cab','Record mileage',1,'vehicle',array['daily'],'form-268-002',2),
      ('Cab','Mobile radio',1,'equipment',array['daily'],'form-268-003',3),
      ('Cab','Knox Box keys',1,'equipment',array['daily'],'form-268-004',4),
      ('Engine Compartment','Engine oil',1,'vehicle',array['daily'],'form-268-005',1),
      ('Engine Compartment','Antifreeze / coolant level',1,'vehicle',array['daily'],'form-268-006',2),
      ('Engine Compartment','Washer fluid',1,'vehicle',array['daily'],'form-268-007',3),
      ('Engine Compartment','Power steering fluid',1,'vehicle',array['daily'],'form-268-008',4),
      ('Engine Compartment','Transmission fluid - engine on and vehicle in park',1,'vehicle',array['daily'],'form-268-009',5),
      ('Engine Compartment','Engine belts condition',1,'vehicle',array['daily'],'form-268-010',6),
      ('Engine Compartment','Battery connections',1,'vehicle',array['daily'],'form-268-011',7),
      ('Engine Compartment','Brake fluid',1,'vehicle',array['daily'],'form-268-012',8),
      ('Lights & Electrical','Head lights',1,'vehicle',array['daily'],'form-268-013',1),
      ('Lights & Electrical','Brake lights',1,'vehicle',array['daily'],'form-268-014',2),
      ('Lights & Electrical','Horn',1,'vehicle',array['daily'],'form-268-015',3),
      ('Lights & Electrical','Emergency lights',1,'vehicle',array['daily'],'form-268-016',4),
      ('Lights & Electrical','Backup light',1,'vehicle',array['daily'],'form-268-017',5),
      ('Lights & Electrical','Turn signals',1,'vehicle',array['daily'],'form-268-018',6),
      ('Lights & Electrical','Wipers',1,'vehicle',array['daily'],'form-268-019',7),
      ('Lights & Electrical','Siren',1,'vehicle',array['daily'],'form-268-020',8)
  )
  insert into public.inventory_equipment
    (department_id, apparatus_id, compartment_id, name, quantity_required,
     equipment_category, check_types, source_key, source_form, item_order)
  select
    stickney_id,
    utility_1209_id,
    c.id,
    source_items.item_name,
    source_items.quantity_required,
    source_items.equipment_category,
    source_items.check_types,
    source_items.source_key,
    '1209 Daily Check form 268',
    source_items.item_order
  from source_items
  join public.inventory_compartments c
    on c.department_id = stickney_id
   and c.apparatus_id = utility_1209_id
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
