do $$
declare
  stickney_id uuid;
  ambulance_1207_id uuid;
begin
  select id into stickney_id
  from public.departments
  where name = 'Stickney Fire Department'
  limit 1;

  if stickney_id is null then
    raise exception 'Stickney Fire Department must exist before adding Ambulance 1207';
  end if;

  select id into ambulance_1207_id
  from public.department_apparatus
  where department_id = stickney_id
    and unit_name = '1207'
  order by created_at
  limit 1;

  if ambulance_1207_id is null then
    insert into public.department_apparatus
      (department_id, unit_name, unit_type, call_sign, station, status, notes)
    values
      (stickney_id, '1207', 'Ambulance', '1207', 'Stickney Fire Department', 'in_service', '')
    returning id into ambulance_1207_id;
  else
    update public.department_apparatus
    set unit_type = 'Ambulance',
        call_sign = '1207',
        station = 'Stickney Fire Department',
        status = 'in_service',
        updated_at = now()
    where id = ambulance_1207_id;
  end if;

  insert into public.inventory_apparatus_profiles
    (id, department_id, name, asset_type)
  values
    (ambulance_1207_id, stickney_id, '1207', 'Ambulance')
  on conflict (id) do update
  set department_id = excluded.department_id,
      name = excluded.name,
      asset_type = excluded.asset_type,
      updated_at = now();
end
$$;
