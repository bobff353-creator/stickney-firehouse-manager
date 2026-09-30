-- Preserve existing results and identifiers. Extend future atomic writes only.
CREATE OR REPLACE FUNCTION public.inventory_record_item_atomic(
  p_department_id uuid, p_check_item_id uuid, p_result text,
  p_notes text DEFAULT NULL, p_numeric_reading numeric DEFAULT NULL,
  p_evidence_photo_id uuid DEFAULT NULL, p_categories text[] DEFAULT '{}',
  p_assigned_ids text[] DEFAULT '{}', p_assigned_names text[] DEFAULT '{}'
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE item public.inventory_check_items%ROWTYPE;
  inspection public.inventory_checks%ROWTYPE;
  equipment public.inventory_equipment%ROWTYPE;
  exception_id uuid; actor text; failure boolean; priority text; numeric_item boolean;
BEGIN
  IF auth.uid() IS NULL OR NOT private.inventory_can_write(p_department_id) THEN
    RAISE EXCEPTION 'Inventory writing permission required' USING ERRCODE='42501';
  END IF;
  actor := COALESCE(auth.jwt()->>'email', auth.uid()::text);
  IF p_result IS NULL OR p_result NOT IN ('pass','failed','missing','damaged','not_applicable') THEN RAISE EXCEPTION 'Invalid inspection result'; END IF;
  SELECT * INTO item FROM public.inventory_check_items WHERE id=p_check_item_id AND department_id=p_department_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Check item not found'; END IF;
  -- Lock the parent first; completion and result writes use the same order.
  SELECT * INTO inspection FROM public.inventory_checks WHERE id=item.check_id AND department_id=p_department_id FOR UPDATE;
  IF NOT FOUND OR inspection.status <> 'in_progress' THEN RAISE EXCEPTION 'This inspection is no longer in progress'; END IF;
  SELECT * INTO item FROM public.inventory_check_items WHERE id=p_check_item_id AND department_id=p_department_id FOR UPDATE;
  SELECT * INTO equipment FROM public.inventory_equipment WHERE id=item.equipment_id AND department_id=p_department_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Equipment not found'; END IF;
  numeric_item := COALESCE(equipment.response_type IN ('numeric','mileage','quantity'),false) OR equipment.name ~* '\m(miles|mileage|odometer|milage|millage)\M';
  IF numeric_item AND (p_numeric_reading IS NULL OR p_numeric_reading < 0 OR p_numeric_reading::text IN ('NaN','Infinity','-Infinity') OR p_result <> 'pass') THEN RAISE EXCEPTION 'A valid numeric reading is required'; END IF;
  IF equipment.name ~* '\m(engine oil|transmission fluid)\M' AND NOT (
    (p_result='pass' AND split_part(COALESCE(p_notes,''),E'\n',1)='Fluid level: In range') OR
    (p_result='failed' AND split_part(COALESCE(p_notes,''),E'\n',1) IN ('Fluid level: Low','Fluid level: High'))
  ) THEN RAISE EXCEPTION 'Choose Low, In range, or High for this fluid level'; END IF;
  failure := p_result IN ('failed','missing','damaged');
  IF failure AND (NULLIF(btrim(p_notes),'') IS NULL OR p_evidence_photo_id IS NULL) THEN RAISE EXCEPTION 'A failed item requires notes and a photo'; END IF;
  IF p_evidence_photo_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.inventory_deficiency_photos WHERE id=p_evidence_photo_id AND department_id=p_department_id AND apparatus_id=inspection.apparatus_id AND check_item_id=item.id) THEN RAISE EXCEPTION 'Photo does not match this item'; END IF;
  UPDATE public.inventory_check_items SET result=p_result,notes=p_notes,numeric_reading=CASE WHEN numeric_item THEN p_numeric_reading ELSE NULL END,checked_by=actor,checked_at=now() WHERE id=item.id AND department_id=p_department_id RETURNING * INTO item;
  IF NOT FOUND THEN RAISE EXCEPTION 'Check item could not be saved' USING ERRCODE='42501'; END IF;
  IF failure THEN
    priority := CASE WHEN p_result='missing' THEN 'high' ELSE 'medium' END;
    IF (SELECT count(*) FROM public.inventory_readiness_exceptions WHERE department_id=p_department_id AND check_item_id=item.id AND status <> 'resolved') > 1 THEN RAISE EXCEPTION 'Multiple open repair notices need administrator review'; END IF;
    SELECT id INTO exception_id FROM public.inventory_readiness_exceptions WHERE department_id=p_department_id AND check_item_id=item.id AND status <> 'resolved' FOR UPDATE;
    IF exception_id IS NULL THEN
      INSERT INTO public.inventory_readiness_exceptions(department_id,apparatus_id,equipment_id,check_item_id,result,priority,notes,status,out_of_service,opened_by,issue_categories,assigned_employee_ids,assigned_employee_names,evidence_photo_id)
      VALUES(p_department_id,inspection.apparatus_id,item.equipment_id,item.id,p_result,priority,p_notes,'open',false,actor,CASE WHEN cardinality(p_categories)>0 THEN p_categories ELSE ARRAY[COALESCE(equipment.equipment_category,'equipment')] END,p_assigned_ids,p_assigned_names,p_evidence_photo_id) RETURNING id INTO exception_id;
    ELSE
      UPDATE public.inventory_readiness_exceptions SET result=p_result,priority=CASE WHEN p_result='missing' THEN 'high' ELSE 'medium' END,notes=p_notes,issue_categories=CASE WHEN cardinality(p_categories)>0 THEN p_categories ELSE ARRAY[COALESCE(equipment.equipment_category,'equipment')] END,assigned_employee_ids=p_assigned_ids,assigned_employee_names=p_assigned_names,evidence_photo_id=p_evidence_photo_id WHERE id=exception_id AND department_id=p_department_id;
      IF NOT FOUND THEN RAISE EXCEPTION 'Repair notice could not be saved' USING ERRCODE='42501'; END IF;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.inventory_work_orders WHERE department_id=p_department_id AND linked_exception_id=exception_id AND status <> 'closed') THEN
      INSERT INTO public.inventory_work_orders(department_id,apparatus_id,equipment_id,linked_exception_id,status,priority,summary,details,assigned_to,assigned_employee_ids,assigned_employee_names,opened_by)
      VALUES(p_department_id,inspection.apparatus_id,item.equipment_id,exception_id,'new',priority,equipment.name || ' failed ' || replace(inspection.check_type,'_',' ') || ' check',p_notes,NULLIF(array_to_string(p_assigned_names,', '),''),p_assigned_ids,p_assigned_names,actor);
    END IF;
  END IF;
  RETURN jsonb_build_object('saved',true,'checkItems',jsonb_build_array(to_jsonb(item)));
END $$;
REVOKE ALL ON FUNCTION public.inventory_record_item_atomic(uuid,uuid,text,text,numeric,uuid,text[],text[],text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.inventory_record_item_atomic(uuid,uuid,text,text,numeric,uuid,text[],text[],text[]) TO authenticated;

