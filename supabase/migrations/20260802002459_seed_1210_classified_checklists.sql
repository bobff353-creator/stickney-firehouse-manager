do $$
declare
  stickney_id uuid;
  chief_car_1210_id uuid;
begin
  select id into stickney_id
  from public.departments
  where name = 'Stickney Fire Department'
  limit 1;

  select id into chief_car_1210_id
  from public.inventory_apparatus_profiles
  where department_id = stickney_id and name = '1210'
  limit 1;

  if stickney_id is null or chief_car_1210_id is null then
    raise exception 'Stickney Fire Department apparatus 1210 must exist before loading form 467';
  end if;

  insert into public.inventory_compartments
    (department_id, apparatus_id, label, side, sort_order)
  values
    (stickney_id, chief_car_1210_id, 'Vehicle', 'cab', 100),
    (stickney_id, chief_car_1210_id, 'Disinfection / Cleaning', 'interior', 110),
    (stickney_id, chief_car_1210_id, 'Front Tires', 'front', 120),
    (stickney_id, chief_car_1210_id, 'Rear Tires', 'rear', 130),
    (stickney_id, chief_car_1210_id, 'Cab', 'cab', 200)
  on conflict (apparatus_id, label) do update
  set side = excluded.side,
      sort_order = excluded.sort_order;

  with source_items(section_label, item_name, quantity_required, equipment_category, check_types, item_order) as (
    values
      ('Vehicle','Fuel - fill at or below 3/4',1,'vehicle',array['weekly'],1),
      ('Vehicle','Record mileage',1,'vehicle',array['weekly'],2),
      ('Vehicle','Engine oil',1,'vehicle',array['weekly'],3),
      ('Vehicle','Coolant / radiator level',1,'vehicle',array['weekly'],4),
      ('Vehicle','Power steering fluid',1,'vehicle',array['weekly'],5),
      ('Vehicle','Battery terminals tight and free of corrosion',1,'vehicle',array['weekly'],6),
      ('Vehicle','Belts tight and in good condition',1,'vehicle',array['weekly'],7),
      ('Vehicle','Dash gauges and electronics functioning properly',1,'vehicle',array['weekly'],8),
      ('Vehicle','Head lights and brake lights functioning properly',1,'vehicle',array['weekly'],9),
      ('Vehicle','Running lights functioning properly',1,'vehicle',array['weekly'],10),
      ('Vehicle','Turn signals and hazards functioning properly',1,'vehicle',array['weekly'],11),
      ('Vehicle','All interior lights functioning properly',1,'vehicle',array['weekly'],12),
      ('Vehicle','Siren and horn functioning properly',1,'vehicle',array['weekly'],13),
      ('Vehicle','Emergency lights functioning properly',1,'vehicle',array['weekly'],14),
      ('Vehicle','Backup lights and alarm functioning properly',1,'vehicle',array['weekly'],15),
      ('Vehicle','Overall body condition and observed damage',1,'vehicle',array['weekly'],16),
      ('Disinfection / Cleaning','Wipe down and disinfect all hard surfaces',1,'vehicle',array['weekly'],1),
      ('Front Tires','Front left PSI',1,'vehicle',array['weekly'],1),
      ('Front Tires','Front right PSI',1,'vehicle',array['weekly'],2),
      ('Rear Tires','Rear left PSI',1,'vehicle',array['weekly'],1),
      ('Rear Tires','Rear right PSI',1,'vehicle',array['weekly'],2),
      ('Cab','Insurance card',1,'equipment',array['inventory'],1),
      ('Cab','Registration',1,'equipment',array['inventory'],2),
      ('Cab','Fire extinguisher',1,'equipment',array['inventory'],3),
      ('Cab','Safety vests',2,'equipment',array['inventory'],4),
      ('Cab','Mobile radio',1,'equipment',array['inventory'],5),
      ('Cab','Knox Box keys',1,'equipment',array['inventory'],6),
      ('Cab','Door opener',1,'equipment',array['inventory'],7),
      ('Cab','I-PASS',1,'equipment',array['inventory'],8),
      ('Cab','Emergency Response Guidebook',1,'equipment',array['inventory'],9)
  ), ranked_items as (
    select
      source_items.*,
      c.id as compartment_id,
      'form-467-' || lpad(row_number() over (
        order by c.sort_order, source_items.item_order, source_items.item_name
      )::text, 3, '0') as source_key
    from source_items
    join public.inventory_compartments c
      on c.department_id = stickney_id
     and c.apparatus_id = chief_car_1210_id
     and c.label = source_items.section_label
  )
  insert into public.inventory_equipment
    (department_id, apparatus_id, compartment_id, name, quantity_required,
     equipment_category, check_types, source_key, source_form, item_order)
  select
    stickney_id,
    chief_car_1210_id,
    ranked_items.compartment_id,
    ranked_items.item_name,
    ranked_items.quantity_required,
    ranked_items.equipment_category,
    ranked_items.check_types,
    ranked_items.source_key,
    '1210 Weekly Check form 467',
    ranked_items.item_order
  from ranked_items
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
