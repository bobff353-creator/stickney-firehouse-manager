-- SOURCE-VERIFIED CONFIGURATION
-- Forms captured from Aladtec. Department instruction supersedes form 393's old first-Sunday run date.
DO $setup$
DECLARE
  dept uuid := '14a76771-4c24-481b-8def-e6cce005c17b';
  utility uuid;
  trailer uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.departments WHERE id=dept AND name='Stickney Fire Department') THEN
    RAISE EXCEPTION 'Verified Stickney department is required';
  END IF;
  SELECT id INTO STRICT utility FROM public.inventory_apparatus_profiles WHERE department_id=dept AND name='1211';
  IF (SELECT count(*) FROM public.inventory_equipment WHERE department_id=dept AND apparatus_id=utility AND source_key LIKE 'form-466-%' AND retired_at IS NULL)<>32 THEN
    RAISE EXCEPTION 'Expected the 32 preserved 1211 Aladtec equipment IDs';
  END IF;
  UPDATE public.inventory_equipment e SET
    check_types=CASE WHEN 'weekly'=ANY(e.check_types) THEN e.check_types ELSE array_append(e.check_types,'weekly') END,
    response_type=CASE WHEN e.response_type='pass_fail' AND e.source_key='form-466-002' THEN 'mileage' WHEN e.response_type='pass_fail' AND e.source_key IN ('form-466-018','form-466-019','form-466-020','form-466-021') THEN 'numeric' ELSE e.response_type END
  WHERE e.department_id=dept AND e.apparatus_id=utility AND e.source_key LIKE 'form-466-%' AND e.retired_at IS NULL;
  UPDATE public.inventory_equipment e SET
    check_types=CASE WHEN 'daily'=ANY(e.check_types) THEN e.check_types ELSE array_append(e.check_types,'daily') END,
    source_form=CASE WHEN position('form 482' IN e.source_form)>0 THEN e.source_form ELSE e.source_form||'; 1211 Daily Check form 482' END
  WHERE e.department_id=dept AND e.apparatus_id=utility AND e.source_key IN ('form-466-001','form-466-002','form-466-003','form-466-004','form-466-005','form-466-006','form-466-008','form-466-009','form-466-010','form-466-011','form-466-012','form-466-013','form-466-014','form-466-015','form-466-016','form-466-022','form-466-024','form-466-025','form-466-026','form-466-027','form-466-029','form-466-030','form-466-031','form-466-032') AND e.retired_at IS NULL;
  INSERT INTO public.inventory_inspection_schedules(department_id,apparatus_id,check_type,day_of_week,start_time,end_time,created_by,updated_by)
  SELECT dept,utility,'daily',day,'06:00'::time,'12:00'::time,'Aladtec 1211 daily checklist setup','Aladtec 1211 daily checklist setup' FROM generate_series(0,6) day
  ON CONFLICT (department_id,apparatus_id,check_type,day_of_week) DO NOTHING;
  INSERT INTO public.inventory_inspection_schedules(department_id,apparatus_id,check_type,day_of_week,start_time,end_time,created_by,updated_by)
  VALUES(dept,utility,'weekly',0,'06:00','12:00','Aladtec 1211 weekly checklist setup','Aladtec 1211 weekly checklist setup')
  ON CONFLICT (department_id,apparatus_id,check_type,day_of_week) DO NOTHING;
  SELECT id INTO trailer FROM public.department_apparatus WHERE department_id=dept AND lower(unit_name)='div 11 light trailer';
  IF trailer IS NULL THEN
    INSERT INTO public.department_apparatus(department_id,unit_name,unit_type,call_sign,status,notes)
    VALUES(dept,'Div 11 Light Trailer','Light tower trailer','','in_service','Source: Aladtec Division XI Weekly Light Tower Trailer Check, form 393. Current In service status confirmed by department. No VIN, serial number, model, or station inferred.') RETURNING id INTO trailer;
  END IF;
  INSERT INTO public.inventory_apparatus_profiles(id,department_id,name,asset_type,weekly_due_day)
  VALUES(trailer,dept,'Div 11 Light Trailer','Light tower trailer',6) ON CONFLICT(id) DO NOTHING;
  INSERT INTO public.inventory_compartments(department_id,apparatus_id,label,side,sort_order)
  VALUES(dept,trailer,'Mechanical','interior',100),(dept,trailer,'Inventory','interior',200)
  ON CONFLICT(apparatus_id,label) DO NOTHING;
  WITH source_items(section,name,quantity,source_key,item_order,recurrence) AS (VALUES
    ('Mechanical','Oil level',1,'form-393-001',1,'every_week'),
    ('Mechanical','Fuel',1,'form-393-002',2,'every_week'),
    ('Mechanical','Water',1,'form-393-003',3,'every_week'),
    ('Mechanical','Tire pressure',1,'form-393-004',4,'every_week'),
    ('Mechanical','Glow plugs',1,'form-393-005',5,'every_week'),
    ('Mechanical','Any damage',1,'form-393-006',6,'every_week'),
    ('Mechanical','Run for 20 minutes (1st and 3rd Saturdays)',1,'form-393-007',7,'first_third_saturday'),
    ('Inventory','Grounding rod w/ (2) wing nuts',1,'form-393-008',8,'every_week'),
    ('Inventory','Wheel chock',1,'form-393-009',9,'every_week'),
    ('Inventory','Key ring w/ three keys',1,'form-393-010',10,'every_week'),
    ('Inventory','Pad lock',1,'form-393-011',11,'every_week'),
    ('Inventory','Wire cutter',1,'form-393-012',12,'every_week'),
    ('Inventory','Ratchet wrench w/ 3/4" socket',1,'form-393-013',13,'every_week'),
    ('Inventory','Bag of spare nuts & washers (4 each)',1,'form-393-014',14,'every_week'),
    ('Inventory','Package of wire ties',1,'form-393-015',15,'every_week'),
    ('Inventory','Three prong adaptor cords',2,'form-393-016',16,'every_week'),
    ('Inventory','Three prong to house plug adaptor',2,'form-393-017',17,'every_week'),
    ('Inventory','Cord reel w/ cord',1,'form-393-018',18,'every_week'),
    ('Inventory','Tie down strap w/ ratchet',1,'form-393-019',19,'every_week'),
    ('Inventory','Junction box',1,'form-393-020',20,'every_week'),
    ('Inventory','Three prong extension cord',1,'form-393-021',21,'every_week'),
    ('Inventory','Grounding rod wire',1,'form-393-022',22,'every_week'),
    ('Inventory','Spare tire',1,'form-393-023',23,'every_week'),
    ('Inventory','Vapor lights',4,'form-393-024',24,'every_week'),
    ('Inventory','Tire iron',1,'form-393-025',25,'every_week')
  )
  INSERT INTO public.inventory_equipment(department_id,apparatus_id,compartment_id,name,quantity_required,equipment_category,check_types,source_key,source_form,item_order,weekly_recurrence)
  SELECT dept,trailer,c.id,s.name,s.quantity,CASE WHEN s.section='Mechanical' THEN 'vehicle' ELSE 'equipment' END,ARRAY['weekly'],s.source_key,
    CASE WHEN s.recurrence='first_third_saturday' THEN 'Aladtec form 393: Run for 20 minutes (original instruction: 1st Sunday of the month). Department updated schedule: first and third Saturdays, afternoon.' ELSE 'Division XI Weekly Light Tower Trailer Check, Aladtec form 393' END,s.item_order,s.recurrence
  FROM source_items s JOIN public.inventory_compartments c ON c.department_id=dept AND c.apparatus_id=trailer AND c.label=s.section
  ON CONFLICT (department_id,apparatus_id,source_key) WHERE source_key IS NOT NULL DO NOTHING;
  INSERT INTO public.inventory_inspection_schedules(department_id,apparatus_id,check_type,day_of_week,start_time,end_time,created_by,updated_by)
  VALUES(dept,trailer,'weekly',6,'12:00','18:00','Aladtec trailer checklist setup','Department Saturday afternoon instruction')
  ON CONFLICT (department_id,apparatus_id,check_type,day_of_week) DO NOTHING;
END $setup$;
