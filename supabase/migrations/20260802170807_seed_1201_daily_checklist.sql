do $$
declare
  stickney_id uuid;
  engine_1201_id uuid;
begin
  select id into stickney_id
  from public.departments
  where name = 'Stickney Fire Department'
  limit 1;

  select id into engine_1201_id
  from public.inventory_apparatus_profiles
  where department_id = stickney_id and name = '1201'
  limit 1;

  if stickney_id is null or engine_1201_id is null then
    raise exception 'Stickney Fire Department apparatus 1201 must exist before loading daily form 256';
  end if;

  insert into public.inventory_compartments
    (department_id, apparatus_id, label, side, sort_order)
  values
    (stickney_id, engine_1201_id, 'Vehicle', 'cab', 100),
    (stickney_id, engine_1201_id, 'Pump / Booster & Foam Tank', 'pump', 160),
    (stickney_id, engine_1201_id, 'Cab', 'cab', 130),
    (stickney_id, engine_1201_id, 'Tools & Equipment', 'rear', 350)
  on conflict (apparatus_id, label) do update
  set side = excluded.side,
      sort_order = excluded.sort_order;

  with source_items(section_label, item_name, quantity_required, equipment_category, check_types, source_key, item_order) as (
    values
      ('Vehicle','Record miles',1,'vehicle',array['daily'],'form-256-001',1),
      ('Vehicle','Fuel - must be at least 3/4',1,'vehicle',array['daily'],'form-256-002',2),
      ('Vehicle','Airhorn operational',1,'vehicle',array['daily'],'form-256-003',3),
      ('Vehicle','Vehicle horn operational',1,'vehicle',array['daily'],'form-256-004',4),
      ('Vehicle','Siren operational',1,'vehicle',array['daily'],'form-256-005',5),
      ('Vehicle','Head lights / brake lights / turn signals operational',1,'vehicle',array['daily'],'form-256-006',6),
      ('Vehicle','Parking brake operational',1,'vehicle',array['daily'],'form-256-007',7),
      ('Vehicle','Emergency lights operational',1,'vehicle',array['daily'],'form-256-008',8),
      ('Vehicle','Transmission fluid - check with engine running',1,'vehicle',array['daily'],'form-256-009',9),
      ('Vehicle','Engine oil',1,'vehicle',array['daily'],'form-256-010',10),
      ('Pump / Booster & Foam Tank','Water tank level - Full required',1,'vehicle',array['daily'],'form-256-011',1),
      ('Pump / Booster & Foam Tank','Foam tank level - verify level',1,'vehicle',array['daily'],'form-256-012',2),
      ('Pump / Booster & Foam Tank','Exercise primer, pressure governor and circulate water',1,'vehicle',array['daily'],'form-256-013',3),
      ('Pump / Booster & Foam Tank','Vehicle goes into pump and recirculates water',1,'vehicle',array['daily'],'form-256-014',4),
      ('Cab','Door opener',1,'equipment',array['daily'],'form-256-015',1),
      ('Cab','Knox Box keys',1,'equipment',array['daily'],'form-256-016',2),
      ('Cab','5 gas meter - fully charged',1,'equipment',array['daily'],'form-256-017',3),
      ('Cab','Portable radios - charged and on channel 1',4,'equipment',array['daily'],'form-256-018',4),
      ('Cab','Thermal imaging camera (TIC) - charged',1,'equipment',array['daily'],'form-256-019',5),
      ('Cab','R.I.T. bag - cylinder at 4500 PSI',1,'air_pack',array['daily'],'form-256-020',6),
      ('Cab','Gloves LG / XL',1,'equipment',array['daily'],'form-256-021',7),
      ('Cab','Cooler with water and ice',1,'equipment',array['daily'],'form-256-022',8),
      ('Cab','Fuel card and PIN',1,'equipment',array['daily'],'form-256-023',9),
      ('Tools & Equipment','Run and operate all power tools',1,'equipment',array['daily'],'form-256-024',1),
      ('Tools & Equipment','Visually check all other hose, tools and equipment',1,'equipment',array['daily'],'form-256-025',2)
  )
  insert into public.inventory_equipment
    (department_id, apparatus_id, compartment_id, name, quantity_required,
     equipment_category, check_types, source_key, source_form, item_order)
  select
    stickney_id,
    engine_1201_id,
    c.id,
    source_items.item_name,
    source_items.quantity_required,
    source_items.equipment_category,
    source_items.check_types,
    source_items.source_key,
    '1201 Daily Check form 256',
    source_items.item_order
  from source_items
  join public.inventory_compartments c
    on c.department_id = stickney_id
   and c.apparatus_id = engine_1201_id
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
