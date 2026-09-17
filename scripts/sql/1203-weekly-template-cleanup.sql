-- One-time, department-approved configuration correction (2026-09-17).
-- Target: datqzdndkrfyovhwppuq / Stickney Fire Department / apparatus 1203.
-- Run manually after backing up the matching inventory_equipment rows.
-- Remove only the weekly tag from the 17 annotated equipment groups.
-- Preserve Inventory, Air Pack, SCBA, equipment records, and check snapshots.
-- Do not add to automatic migrations: this is editable department configuration.
begin;
set local statement_timeout = '10s';
set local lock_timeout = '3s';

do $cleanup$
declare
  changed_count integer;
begin
  update public.inventory_equipment e
  set check_types = array_remove(e.check_types, 'weekly'),
      updated_at = now()
  from public.inventory_compartments c,
       public.inventory_apparatus_profiles p,
       public.departments d
  where e.department_id = '14a76771-4c24-481b-8def-e6cce005c17b'
    and e.apparatus_id = '221ef2ce-2a51-4450-bc2a-62d6b6ecefe6'
    and e.retired_at is null
    and e.check_types @> array['weekly', 'inventory']::text[]
    and c.id = e.compartment_id
    and c.department_id = e.department_id
    and c.apparatus_id = e.apparatus_id
    and p.id = e.apparatus_id
    and p.department_id = e.department_id
    and p.name = '1203'
    and d.id = e.department_id
    and d.name = 'Stickney Fire Department'
    and c.label in (
      'Driver Side Step', 'Compartment 1 (Top)', 'Compartment 1 (Bottom)',
      'Compartment 2', 'Driver''s Side Drawer', 'Compartment 3',
      'Driver''s Side', 'Compartment 4', 'Rear Compartment',
      'Compartment 5', 'Compartment 6', 'Officer''s Side Drawer',
      'Compartment 7', 'Officer''s Side', 'Officer''s Side Step',
      'Top of Engine', 'Hose'
    );

  get diagnostics changed_count = row_count;
  -- All 176 approved rows, or a no-op when this correction is already applied.
  -- Unexpected partial sets roll back; review rather than broaden the filter.
  if changed_count not in (0, 176) then
    raise exception '1203 Weekly cleanup expected 176 or 0 rows; got %', changed_count;
  end if;
end;
$cleanup$;

commit;
