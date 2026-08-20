do $$
declare
  stickney_id uuid;
begin
  select id into stickney_id
  from public.departments
  where name = 'Stickney Fire Department'
  limit 1;

  if stickney_id is null then
    raise exception 'Stickney Fire Department must exist before correcting the 1203 and 1204 cab inventory locations';
  end if;

  update public.inventory_equipment ie
  set check_types = case
        when ie.equipment_category = 'air_pack' then array['air_pack']::text[]
        else array['inventory']::text[]
      end
  from public.inventory_compartments c,
       public.inventory_apparatus_profiles ap
  where c.id = ie.compartment_id
    and ap.id = ie.apparatus_id
    and ie.department_id = stickney_id
    and ap.department_id = stickney_id
    and ap.name in ('1203', '1204')
    and c.label in ('Cab', 'Cab - Cabinet', 'Glove Box')
    and ie.source_form in (
      '1203 Weekly Check (FRONTLINE) form 251',
      '1204 Weekly Check form 439'
    );

  update public.inventory_compartments c
  set label = 'Cab - Glove Box'
  from public.inventory_apparatus_profiles ap
  where ap.id = c.apparatus_id
    and c.department_id = stickney_id
    and ap.department_id = stickney_id
    and ap.name = '1203'
    and c.label = 'Glove Box';
end $$;
