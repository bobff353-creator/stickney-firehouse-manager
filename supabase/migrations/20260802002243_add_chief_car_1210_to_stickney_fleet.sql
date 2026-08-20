do $$
declare
  stickney_id uuid;
  chief_car_1210_id uuid;
begin
  select id into stickney_id
  from public.departments
  where name = 'Stickney Fire Department'
  limit 1;

  if stickney_id is null then
    raise exception 'Stickney Fire Department must exist before adding Chief Car 1210';
  end if;

  select id into chief_car_1210_id
  from public.department_apparatus
  where department_id = stickney_id
    and unit_name = '1210'
  order by created_at
  limit 1;

  if chief_car_1210_id is null then
    insert into public.department_apparatus
      (department_id, unit_name, unit_type, call_sign, station, status, notes)
    values
      (stickney_id, '1210', 'Chief Car', '1210', 'Stickney Fire Department', 'in_service', '')
    returning id into chief_car_1210_id;
  else
    update public.department_apparatus
    set unit_type = 'Chief Car',
        call_sign = '1210',
        station = 'Stickney Fire Department',
        status = 'in_service',
        updated_at = now()
    where id = chief_car_1210_id;
  end if;

  insert into public.inventory_apparatus_profiles
    (id, department_id, name, asset_type)
  values
    (chief_car_1210_id, stickney_id, '1210', 'Chief Car')
  on conflict (id) do update
  set department_id = excluded.department_id,
      name = excluded.name,
      asset_type = excluded.asset_type,
      updated_at = now();
end
$$;
