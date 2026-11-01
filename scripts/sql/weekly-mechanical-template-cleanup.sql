-- One-time Stickney configuration correction, reviewed 2026-11-01 UTC.
-- Weekly apparatus checks cover mechanical condition, functional testing and maintenance.
-- Carried-item counts stay in Inventory; existing Air Pack assignments remain. The two structured
-- weekly meter inspections remain: they are functional forms, not stock counts.
-- Apply manually after backing up the 163 matching equipment rows. This is editable
-- department configuration, not an automatic migration or a history backfill.
BEGIN;
SET LOCAL statement_timeout = '10s';
SET LOCAL lock_timeout = '3s';

DO $cleanup$
DECLARE
  dept uuid := '14a76771-4c24-481b-8def-e6cce005c17b';
  reviewed record;
  matching_ids uuid[];
  target_ids uuid[] := '{}'::uuid[];
  matching_count integer;
  changed_count integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.departments WHERE id=dept AND name='Stickney Fire Department') THEN
    RAISE EXCEPTION 'Verified Stickney department is required';
  END IF;

  FOR reviewed IN SELECT * FROM (VALUES
    -- 1203: SCBA harnesses and spare-cylinder inventory; retain separate air checks.
    ('1203', 'frontline-251-', 103, 113, 11),
    -- 1204: SCBA and carried gear. Gaps retain pump controls and saw servicing.
    ('1204', 'form-439-', 38, 48, 11),
    ('1204', 'form-439-', 51, 65, 15),
    ('1204', 'form-439-', 68, 113, 46),
    ('1204', 'form-439-', 116, 166, 51),
    -- 1211: cab inventory plus its separate Driver SCBA entry.
    ('1211', 'form-466-', 22, 32, 11),
    -- Trailer: the source form's Inventory section; retain all seven Mechanical tasks.
    ('Div 11 Light Trailer', 'form-393-', 8, 25, 18)
  ) AS approved(apparatus, prefix, first_item, last_item, expected_count)
  LOOP
    SELECT array_agg(e.id ORDER BY e.id),count(*) INTO matching_ids,matching_count
    FROM public.inventory_equipment e
    JOIN public.inventory_apparatus_profiles p ON p.id=e.apparatus_id AND p.department_id=e.department_id
    JOIN public.inventory_compartments c ON c.id=e.compartment_id AND c.department_id=e.department_id AND c.apparatus_id=e.apparatus_id
    WHERE e.department_id=dept AND p.name=reviewed.apparatus AND e.retired_at IS NULL
      AND 'weekly'=ANY(e.check_types) AND e.meter_template IS NULL
      AND e.source_key IN (SELECT reviewed.prefix||lpad(n::text,3,'0') FROM generate_series(reviewed.first_item,reviewed.last_item) n)
      AND CASE WHEN reviewed.apparatus='Div 11 Light Trailer' THEN c.label='Inventory'
               ELSE e.check_types && ARRAY['inventory','air_pack']::text[] END;
    IF matching_count NOT IN (0,reviewed.expected_count) THEN
      RAISE EXCEPTION 'Weekly cleanup: % % expected % or 0 rows; got %',reviewed.apparatus,reviewed.prefix,reviewed.expected_count,matching_count;
    END IF;
    target_ids:=target_ids||COALESCE(matching_ids,'{}'::uuid[]);
  END LOOP;

  IF cardinality(target_ids) NOT IN (0,163) THEN
    RAISE EXCEPTION 'Weekly cleanup expected the complete 163-row reviewed set or an already-applied correction; got %',cardinality(target_ids);
  END IF;

  UPDATE public.inventory_equipment e
  SET check_types=CASE
        WHEN NOT 'inventory'=ANY(e.check_types)
          THEN array_append(array_remove(e.check_types,'weekly'),'inventory')
        ELSE array_remove(e.check_types,'weekly') END,
      updated_at=now()
  WHERE e.department_id=dept AND e.id=ANY(target_ids);
  GET DIAGNOSTICS changed_count = ROW_COUNT;
  IF changed_count<>cardinality(target_ids) THEN RAISE EXCEPTION 'Weekly cleanup did not update its complete reviewed set'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.inventory_equipment e
    JOIN public.inventory_compartments c ON c.id=e.compartment_id AND c.department_id=e.department_id
    WHERE e.department_id=dept AND e.retired_at IS NULL AND 'weekly'=ANY(e.check_types)
      AND e.meter_template IS NULL
      AND (e.check_types && ARRAY['inventory','air_pack']::text[] OR c.label='Inventory')
  ) THEN RAISE EXCEPTION 'An unreviewed inventory entry remains on a weekly template; review before applying'; END IF;
END $cleanup$;

COMMIT;
