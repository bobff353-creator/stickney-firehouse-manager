-- Source: Aladtec Daily Drug Inventory form 338, captured November 1, 2026 UTC.
-- Only future check assignments change. Existing check rows and results remain intact.
DO $setup$
DECLARE dept uuid:='14a76771-4c24-481b-8def-e6cce005c17b';
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.departments WHERE id=dept AND name='Stickney Fire Department') THEN RAISE EXCEPTION 'Verified Stickney department is required'; END IF;
 IF (SELECT count(*) FROM public.inventory_equipment e JOIN public.inventory_apparatus_profiles p ON p.id=e.apparatus_id AND p.department_id=e.department_id WHERE e.department_id=dept AND e.source_key LIKE 'form-338-%' AND e.retired_at IS NULL AND p.name IN ('1205','1207','1203','1204'))<>48 THEN RAISE EXCEPTION 'Expected the 48 existing Aladtec medication item IDs'; END IF;
 UPDATE public.inventory_equipment e SET
  response_type=CASE WHEN 'drug'=ANY(e.check_types) THEN e.response_type ELSE 'medication' END,
  check_types=CASE WHEN 'drug'=ANY(e.check_types) THEN array_remove(e.check_types,'daily') ELSE array_append(array_remove(e.check_types,'daily'),'drug') END,
  updated_at=now()
 FROM public.inventory_apparatus_profiles p
 WHERE p.id=e.apparatus_id AND p.department_id=e.department_id AND e.department_id=dept AND p.name IN ('1205','1207','1203','1204') AND e.source_key LIKE 'form-338-%' AND e.retired_at IS NULL;
 INSERT INTO public.inventory_inspection_schedules(department_id,apparatus_id,check_type,day_of_week,start_time,end_time,created_by,updated_by)
 SELECT dept,p.id,'drug',day,'06:00'::time,'12:00'::time,'Aladtec Daily Drug Inventory form 338 setup','Department morning daily drug check instruction'
 FROM public.inventory_apparatus_profiles p CROSS JOIN generate_series(0,6) day
 WHERE p.department_id=dept AND p.name IN ('1205','1207','1203','1204')
 ON CONFLICT(department_id,apparatus_id,check_type,day_of_week) DO NOTHING;
END $setup$;
