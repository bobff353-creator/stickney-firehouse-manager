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
    raise exception 'Stickney Fire Department apparatus 1201 must exist before correcting its cab inventory locations';
  end if;

  update public.inventory_equipment ie
  set check_types = array['inventory']::text[],
      equipment_category = 'equipment'
  from public.inventory_compartments c
  where c.id = ie.compartment_id
    and ie.department_id = stickney_id
    and ie.apparatus_id = engine_1201_id
    and ie.source_form = '1201 Weekly Check (RESERVE) form 248'
    and ie.check_types = array['weekly']::text[]
    and c.label in ('Cab', 'Cab - Cabinet', 'Glove box');

  update public.inventory_compartments
  set label = 'Cab - Glove Box'
  where department_id = stickney_id
    and apparatus_id = engine_1201_id
    and label = 'Glove box';
end $$;
