-- Separate current crew work from completed history. All functions retain caller RLS.
create index if not exists inventory_checks_history_page_idx
  on public.inventory_checks (department_id, started_at desc, id desc) where status = 'completed';
create index if not exists inventory_checks_recent_completed_idx
  on public.inventory_checks (department_id, completed_at desc) where status = 'completed';

create or replace function public.inventory_live_check_packet(p_department uuid)
returns jsonb language sql stable security invoker set search_path = '' as $$
  with live as materialized (
    select c.* from public.inventory_checks c
    where c.department_id = p_department and (c.status = 'in_progress'
      or (c.status = 'completed' and c.completed_at >= now() - interval '8 days'))
  )
  select jsonb_build_object(
    'checks', coalesce((select jsonb_agg(to_jsonb(c) order by c.started_at desc, c.id desc) from live c), '[]'::jsonb),
    'checkItems', coalesce((select jsonb_agg(to_jsonb(i) order by i.check_id, i.id)
      from public.inventory_check_items i join live c on c.id = i.check_id
      where i.department_id = p_department and c.status = 'in_progress'), '[]'::jsonb),
    'scbaEntries', coalesce((select jsonb_agg(to_jsonb(i) order by i.check_id, i.sort_order, i.id)
      from public.inventory_scba_check_entries i join live c on c.id = i.check_id
      where i.department_id = p_department and c.status = 'in_progress'), '[]'::jsonb)
  );
$$;

create or replace function public.inventory_check_history_page(
  p_department uuid, p_apparatus uuid default null, p_type text default null,
  p_review text default null, p_from date default null, p_to date default null,
  p_before_time timestamptz default null, p_before_id uuid default null
)
returns setof jsonb language sql stable security invoker set search_path = '' as $$
  with page as materialized (
    select c.* from public.inventory_checks c
    where c.department_id = p_department and c.status = 'completed'
      and (p_apparatus is null or c.apparatus_id = p_apparatus)
      and (p_type is null or c.check_type = p_type)
      and (p_review is null or c.review_status = p_review)
      and (p_from is null or c.completed_at >= (p_from::timestamp at time zone 'America/Chicago'))
      and (p_to is null or c.completed_at < ((p_to + 1)::timestamp at time zone 'America/Chicago'))
      and (p_before_time is null or (c.started_at, c.id) < (p_before_time, p_before_id))
    order by c.started_at desc, c.id desc limit 26
  )
  select to_jsonb(c) || jsonb_build_object('apparatus_name', coalesce(a.name, ''),
    'item_count', totals.items, 'passed_count', totals.passed, 'issue_count', totals.issues)
  from page c left join public.inventory_apparatus_profiles a on a.id = c.apparatus_id and a.department_id = p_department
  cross join lateral (
    select count(*) as items, count(*) filter (where result = 'pass') as passed,
      count(*) filter (where result in ('failed','missing','damaged')) as issues
    from (
      select i.result from public.inventory_check_items i where i.check_id = c.id and i.department_id = p_department and c.check_type <> 'air_pack'
      union all
      select i.result from public.inventory_scba_check_entries i where i.check_id = c.id and i.department_id = p_department and c.check_type = 'air_pack'
    ) results
  ) totals
  order by c.started_at desc, c.id desc;
$$;

create or replace function public.inventory_check_report(p_department uuid, p_check uuid)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object('check', to_jsonb(c) || jsonb_build_object('apparatus_name', coalesce(a.name, '')),
    'items', case when c.check_type = 'air_pack' then
      coalesce((select jsonb_agg(to_jsonb(i) || jsonb_build_object('equipment_name', i.label,
        'compartment_label', case i.section when 'pack' then 'SCBA packs' when 'rit' then 'R.I.T. bag' else 'Spare bottles' end,
        'numeric_reading', i.psi) order by i.sort_order, i.id)
        from public.inventory_scba_check_entries i where i.check_id = c.id and i.department_id = p_department), '[]'::jsonb)
    else coalesce((select jsonb_agg(to_jsonb(i) || jsonb_build_object('equipment_name', coalesce(e.name, ''),
        'compartment_label', coalesce(location.label, '')) order by location.sort_order nulls last, e.item_order, i.id)
        from public.inventory_check_items i
        left join public.inventory_equipment e on e.id = i.equipment_id and e.department_id = p_department
        left join public.inventory_compartments location on location.id = e.compartment_id and location.department_id = p_department
        where i.check_id = c.id and i.department_id = p_department), '[]'::jsonb) end)
  from public.inventory_checks c
  left join public.inventory_apparatus_profiles a on a.id = c.apparatus_id and a.department_id = p_department
  where c.id = p_check and c.department_id = p_department and c.status = 'completed';
$$;

create or replace function public.inventory_air_check_history(
  p_department uuid, p_equipment uuid, p_before_time timestamptz default null, p_before_id uuid default null
)
returns setof jsonb language sql stable security invoker set search_path = '' as $$
  select to_jsonb(i) || jsonb_build_object('started_at',c.started_at,'apparatus_id',c.apparatus_id,'check_type',c.check_type)
  from public.inventory_scba_check_entries i join public.inventory_checks c on c.id = i.check_id and c.department_id = p_department
  where i.department_id = p_department and i.equipment_id = p_equipment
    and (p_before_time is null or (c.started_at,i.id) < (p_before_time,p_before_id))
  order by c.started_at desc,i.id desc limit 26;
$$;

revoke all on function public.inventory_air_check_history(uuid,uuid,timestamptz,uuid) from public, anon;
grant execute on function public.inventory_air_check_history(uuid,uuid,timestamptz,uuid) to authenticated;
revoke all on function public.inventory_live_check_packet(uuid) from public, anon;
revoke all on function public.inventory_check_history_page(uuid,uuid,text,text,date,date,timestamptz,uuid) from public, anon;
revoke all on function public.inventory_check_report(uuid,uuid) from public, anon;
grant execute on function public.inventory_live_check_packet(uuid) to authenticated;
grant execute on function public.inventory_check_history_page(uuid,uuid,text,text,date,date,timestamptz,uuid) to authenticated;
grant execute on function public.inventory_check_report(uuid,uuid) to authenticated;
