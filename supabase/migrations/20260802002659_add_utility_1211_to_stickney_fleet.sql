do $$
declare
  stickney_id uuid;
  utility_1211_id uuid;
begin
  select id into stickney_id
  from public.departments
  where name = 'Stickney Fire Department'
  limit 1;

  if stickney_id is null then
    raise exception 'Stickney Fire Department must exist before adding Utility 1211';
  end if;

  select id into utility_1211_id
  from public.department_apparatus
  where department_id = stickney_id
    and unit_name = '1211'
  order by created_at
  limit 1;

  if utility_1211_id is null then
    insert into public.department_apparatus
      (department_id, unit_name, unit_type, call_sign, station, status, notes)
    values
      (stickney_id, '1211', 'Utility', '1211', 'Stickney Fire Department', 'in_service', '')
    returning id into utility_1211_id;
  else
    update public.department_apparatus
    set unit_type = 'Utility',
        call_sign = '1211',
        station = 'Stickney Fire Department',
        status = 'in_service',
        updated_at = now()
    where id = utility_1211_id;
  end if;

  insert into public.inventory_apparatus_profiles
    (id, department_id, name, asset_type)
  values
    (utility_1211_id, stickney_id, '1211', 'Utility')
  on conflict (id) do update
  set department_id = excluded.department_id,
      name = excluded.name,
      asset_type = excluded.asset_type,
      updated_at = now();
end
$$;
