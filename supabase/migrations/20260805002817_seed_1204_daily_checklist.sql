do $$
declare
  stickney_id uuid;
  truck_1204_id uuid;
begin
  select id into stickney_id
  from public.departments
  where name = 'Stickney Fire Department'
  limit 1;

  select id into truck_1204_id
  from public.inventory_apparatus_profiles
  where department_id = stickney_id and name = '1204'
  limit 1;

  if stickney_id is null or truck_1204_id is null then
    raise exception 'Stickney Fire Department apparatus 1204 must exist before loading daily form 431';
  end if;

  insert into public.inventory_compartments
    (department_id, apparatus_id, label, side, sort_order)
  values
    (stickney_id, truck_1204_id, 'Vehicle', 'cab', 100),
    (stickney_id, truck_1204_id, 'Pump / Booster Tank', 'pump', 160),
    (stickney_id, truck_1204_id, 'Cab', 'cab', 130),
    (stickney_id, truck_1204_id, 'Tools & Equipment', 'rear', 350)
  on conflict (apparatus_id, label) do update
  set side = excluded.side,
      sort_order = excluded.sort_order;

  with source_items(section_label, item_name, quantity_required, equipment_category, check_types, source_key, item_order) as (
    values
      ('Vehicle','Record miles',1,'vehicle',array['daily'],'form-431-001',1),
      ('Vehicle','Record engine hours',1,'vehicle',array['daily'],'form-431-002',2),
      ('Vehicle','Fuel - must be at least 3/4',1,'vehicle',array['daily'],'form-431-003',3),
      ('Vehicle','DEF - refill at 1/2',1,'vehicle',array['daily'],'form-431-004',4),
      ('Vehicle','Airhorn operational',1,'vehicle',array['daily'],'form-431-005',5),
      ('Vehicle','Vehicle horn operational',1,'vehicle',array['daily'],'form-431-006',6),
      ('Vehicle','Siren operational',1,'vehicle',array['daily'],'form-431-007',7),
      ('Vehicle','Head lights / brake lights / turn signals operational',1,'vehicle',array['daily'],'form-431-008',8),
      ('Vehicle','Outrigger stabilizers and aerial operational',1,'vehicle',array['daily'],'form-431-009',9),
      ('Vehicle','Parking brake operational',1,'vehicle',array['daily'],'form-431-010',10),
      ('Vehicle','Emergency lights operational',1,'vehicle',array['daily'],'form-431-011',11),
      ('Vehicle','Transmission fluid - check with engine running',1,'vehicle',array['daily'],'form-431-012',12),
      ('Vehicle','Engine oil',1,'vehicle',array['daily'],'form-431-013',13),
      ('Pump / Booster Tank','Water tank level - Full required',1,'vehicle',array['daily'],'form-431-014',1),
      ('Pump / Booster Tank','Record pump hours',1,'vehicle',array['daily'],'form-431-015',2),
      ('Pump / Booster Tank','Exercise primer, pressure governor and circulate water',1,'vehicle',array['daily'],'form-431-016',3),
      ('Pump / Booster Tank','Vehicle goes into pump and recirculates water',1,'vehicle',array['daily'],'form-431-017',4),
      ('Cab','Door opener',1,'equipment',array['daily'],'form-431-018',1),
      ('Cab','Knox Box keys',1,'equipment',array['daily'],'form-431-019',2),
      ('Cab','5 gas meter - fully charged',1,'equipment',array['daily'],'form-431-020',3),
      ('Cab','Portable radios - charged and on channel 1',4,'equipment',array['daily'],'form-431-021',4),
      ('Cab','Thermal imaging camera (TIC) - charged',1,'equipment',array['daily'],'form-431-022',5),
      ('Cab','R.I.T. bag - cylinder at 4500 PSI',1,'air_pack',array['daily'],'form-431-023',6),
      ('Cab','Gloves LG / XL',1,'equipment',array['daily'],'form-431-024',7),
      ('Cab','Cooler with water and ice',1,'equipment',array['daily'],'form-431-025',8),
      ('Cab','Fuel card and PIN',1,'equipment',array['daily'],'form-431-026',9),
      ('Tools & Equipment','Run and operate all power tools',1,'equipment',array['daily'],'form-431-027',1),
      ('Tools & Equipment','Visually check all other hose, tools and equipment',1,'equipment',array['daily'],'form-431-028',2)
  )
  insert into public.inventory_equipment
    (department_id, apparatus_id, compartment_id, name, quantity_required,
     equipment_category, check_types, source_key, source_form, item_order)
  select
    stickney_id,
    truck_1204_id,
    c.id,
    source_items.item_name,
    source_items.quantity_required,
    source_items.equipment_category,
    source_items.check_types,
    source_items.source_key,
    '1204 Daily Check form 431',
    source_items.item_order
  from source_items
  join public.inventory_compartments c
    on c.department_id = stickney_id
   and c.apparatus_id = truck_1204_id
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
