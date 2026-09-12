-- Additive only: imported checklist lines are NOT converted into physical assets.
ALTER TABLE public.inventory_equipment
 ADD COLUMN scba_asset_kind text CHECK (scba_asset_kind IN ('pack','bottle')),
 ADD COLUMN asset_number text,
 ADD COLUMN sku text,
 ADD COLUMN hydro_test_date date,
 ADD COLUMN hydro_due_date date,
 ADD COLUMN scba_notes text,
 ADD COLUMN scba_check_slot text,
 ADD CONSTRAINT inventory_air_asset_identity CHECK (scba_asset_kind IS NULL OR
   (asset_number IS NOT NULL AND length(btrim(asset_number)) BETWEEN 1 AND 80 AND
    quantity_required=1 AND item_type='individual' AND equipment_category='air_pack')),
 ADD CONSTRAINT inventory_air_hydro_dates CHECK (hydro_due_date IS NULL OR hydro_test_date IS NULL OR hydro_due_date>=hydro_test_date);
-- IDs stay reserved after retirement; old reports must never refer to a different physical asset.
CREATE UNIQUE INDEX inventory_air_asset_number ON public.inventory_equipment(department_id,lower(btrim(asset_number))) WHERE scba_asset_kind IS NOT NULL;
CREATE UNIQUE INDEX inventory_air_check_slot ON public.inventory_equipment(department_id,apparatus_id,scba_check_slot) WHERE scba_asset_kind IS NOT NULL AND retired_at IS NULL AND scba_check_slot IS NOT NULL;
CREATE INDEX inventory_air_location ON public.inventory_equipment(department_id,apparatus_id) WHERE scba_asset_kind IS NOT NULL AND retired_at IS NULL;
ALTER TABLE public.inventory_scba_check_entries
 ADD COLUMN equipment_id uuid REFERENCES public.inventory_equipment(id) ON DELETE RESTRICT,
 ADD COLUMN asset_number text,
 ADD COLUMN location_snapshot text;
CREATE INDEX inventory_air_entry_history ON public.inventory_scba_check_entries(department_id,equipment_id) WHERE equipment_id IS NOT NULL;

CREATE FUNCTION public.inventory_save_air_asset(p_department uuid,p_id uuid,p_expected_updated_at timestamptz,p_asset jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE old_row public.inventory_equipment; new_row public.inventory_equipment; place public.inventory_compartments; rig public.inventory_apparatus_profiles; template public.inventory_scba_templates; slot text;
BEGIN
 IF NOT private.inventory_can_admin(p_department) THEN RAISE EXCEPTION 'Inventory setup permission required' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_department::text,731));
 SELECT * INTO old_row FROM public.inventory_equipment WHERE department_id=p_department AND id=p_id FOR UPDATE;
 IF FOUND AND (old_row.scba_asset_kind IS NULL OR old_row.retired_at IS NOT NULL) THEN RAISE EXCEPTION 'This is not an active registered air asset'; END IF;
 SELECT * INTO place FROM public.inventory_compartments WHERE department_id=p_department AND id=(p_asset->>'compartment_id')::uuid;
 IF NOT FOUND THEN RAISE EXCEPTION 'Choose a saved department location'; END IF;
 SELECT * INTO rig FROM public.inventory_apparatus_profiles WHERE department_id=p_department AND id=place.apparatus_id;
 IF NOT FOUND OR lower(rig.name)='1211' OR lower(rig.name) LIKE '%utv%' OR lower(rig.asset_type)='utv' THEN RAISE EXCEPTION 'Choose an apparatus that uses air checks'; END IF;
 IF p_asset->>'scba_asset_kind' IS NULL OR p_asset->>'scba_asset_kind' NOT IN ('pack','bottle') OR length(btrim(coalesce(p_asset->>'asset_number',''))) NOT BETWEEN 1 AND 80 OR length(btrim(coalesce(p_asset->>'name',''))) NOT BETWEEN 1 AND 240 THEN RAISE EXCEPTION 'Type, unique ID, and name are required'; END IF;
 IF old_row.id IS NOT NULL AND old_row.scba_asset_kind<>p_asset->>'scba_asset_kind' THEN RAISE EXCEPTION 'A pack cannot be changed into a bottle'; END IF;
 new_row:=jsonb_populate_record(old_row,p_asset);
 new_row.id:=p_id; new_row.department_id:=p_department; new_row.apparatus_id:=place.apparatus_id; new_row.compartment_id:=place.id;
 new_row.asset_number:=btrim(new_row.asset_number); new_row.name:=btrim(new_row.name);
 new_row.quantity_required:=1; new_row.item_type:='individual'; new_row.equipment_category:='air_pack';
 slot:=nullif(btrim(new_row.scba_check_slot),''); new_row.scba_check_slot:=slot;
 IF slot IS NOT NULL THEN
  SELECT * INTO template FROM public.inventory_scba_templates WHERE department_id=p_department AND apparatus_id=place.apparatus_id AND active;
  IF NOT FOUND OR NOT (
   (new_row.scba_asset_kind='pack' AND slot=ANY(ARRAY(SELECT 'pack:'||unnest(template.pack_positions)))) OR
   (new_row.scba_asset_kind='bottle' AND ((template.include_rit AND slot='rit:R.I.T. Bag') OR slot=ANY(ARRAY(SELECT 'spare:Spare #'||generate_series(1,template.spare_bottle_count)))))
  ) THEN RAISE EXCEPTION 'That checklist position changed. Choose a current position or Additional item'; END IF;
 END IF;
 IF old_row.id IS NOT NULL THEN
  IF to_jsonb(old_row)=to_jsonb(new_row) THEN RETURN jsonb_build_object('id',old_row.id,'changed',false); END IF;
  IF p_expected_updated_at IS DISTINCT FROM old_row.updated_at THEN RAISE EXCEPTION 'This record changed on another screen. Reopen it before saving' USING ERRCODE='40001'; END IF;
  UPDATE public.inventory_equipment SET name=new_row.name,asset_number=new_row.asset_number,sku=new_row.sku,
   manufacturer=new_row.manufacturer,model=new_row.model,serial_number=new_row.serial_number,barcode=new_row.barcode,
   purchase_date=new_row.purchase_date,in_service_date=new_row.in_service_date,expiration_date=new_row.expiration_date,
   hydro_test_date=new_row.hydro_test_date,hydro_due_date=new_row.hydro_due_date,scba_notes=new_row.scba_notes,
   apparatus_id=new_row.apparatus_id,compartment_id=new_row.compartment_id,scba_check_slot=slot,updated_at=clock_timestamp()
   WHERE department_id=p_department AND id=p_id RETURNING * INTO new_row;
 ELSE
  IF p_expected_updated_at IS NOT NULL THEN RAISE EXCEPTION 'The record no longer exists. Refresh the list'; END IF;
  INSERT INTO public.inventory_equipment(id,department_id,apparatus_id,compartment_id,name,scba_asset_kind,asset_number,sku,manufacturer,model,serial_number,barcode,purchase_date,in_service_date,expiration_date,hydro_test_date,hydro_due_date,scba_notes,scba_check_slot,quantity_required,item_type,equipment_category,check_types)
   VALUES(p_id,p_department,place.apparatus_id,place.id,new_row.name,new_row.scba_asset_kind,new_row.asset_number,new_row.sku,new_row.manufacturer,new_row.model,new_row.serial_number,new_row.barcode,new_row.purchase_date,new_row.in_service_date,new_row.expiration_date,new_row.hydro_test_date,new_row.hydro_due_date,new_row.scba_notes,slot,1,'individual','air_pack',ARRAY['air_pack']) RETURNING * INTO new_row;
 END IF;
 IF new_row.id IS NULL THEN RAISE EXCEPTION 'The record could not be saved'; END IF;
 RETURN jsonb_build_object('id',new_row.id,'changed',true);
END $$;
REVOKE ALL ON FUNCTION public.inventory_save_air_asset(uuid,uuid,timestamptz,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.inventory_save_air_asset(uuid,uuid,timestamptz,jsonb) TO authenticated;

-- Check creation and its exact asset/location snapshot are one transaction.
CREATE FUNCTION public.inventory_start_air_check(p_department uuid,p_apparatus uuid,p_shift text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE v_check_id uuid; template public.inventory_scba_templates; rig public.inventory_apparatus_profiles; asset record; position text; seq int:=0; matches int; actor text;
BEGIN
 IF NOT private.inventory_can_write(p_department) OR (p_department='14a76771-4c24-481b-8def-e6cce005c17b'::uuid AND NOT private.portal_has_permission('inventory.check')) THEN RAISE EXCEPTION 'Inventory check permission required' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_department::text,731));
 SELECT id INTO v_check_id FROM public.inventory_checks WHERE department_id=p_department AND apparatus_id=p_apparatus AND check_type='air_pack' AND status='in_progress' LIMIT 1;
 IF FOUND THEN RETURN jsonb_build_object('checkId',v_check_id,'resumed',true); END IF;
 SELECT * INTO rig FROM public.inventory_apparatus_profiles WHERE department_id=p_department AND id=p_apparatus;
 IF NOT FOUND OR lower(rig.name)='1211' OR lower(rig.name) LIKE '%utv%' OR lower(rig.asset_type)='utv' THEN RAISE EXCEPTION 'Choose an apparatus that uses air checks'; END IF;
 actor:=coalesce(auth.jwt()->>'email',auth.uid()::text);
 v_check_id:=gen_random_uuid();
 INSERT INTO public.inventory_checks(id,department_id,apparatus_id,shift_id,check_type,status,started_by) VALUES(v_check_id,p_department,p_apparatus,p_shift,'air_pack','in_progress',actor);
 SELECT * INTO template FROM public.inventory_scba_templates WHERE department_id=p_department AND apparatus_id=p_apparatus AND active;
 IF FOUND THEN
  FOREACH position IN ARRAY template.pack_positions LOOP
   seq:=seq+1;
   INSERT INTO public.inventory_scba_check_entries(department_id,check_id,section,label,sort_order) VALUES(p_department,v_check_id,'pack',position,seq);
  END LOOP;
  IF template.include_rit THEN
   seq:=seq+1;
   INSERT INTO public.inventory_scba_check_entries(department_id,check_id,section,label,sort_order) VALUES(p_department,v_check_id,'rit','R.I.T. Bag',seq);
  END IF;
  FOR n IN 1..template.spare_bottle_count LOOP
   seq:=seq+1;
   INSERT INTO public.inventory_scba_check_entries(department_id,check_id,section,label,sort_order) VALUES(p_department,v_check_id,'spare','Spare #'||n,seq);
  END LOOP;
 END IF;
 FOR asset IN SELECT e.*,c.label location FROM public.inventory_equipment e JOIN public.inventory_compartments c ON c.id=e.compartment_id AND c.department_id=e.department_id
  WHERE e.department_id=p_department AND e.apparatus_id=p_apparatus AND e.scba_asset_kind IS NOT NULL AND e.retired_at IS NULL ORDER BY e.asset_number LOOP
  UPDATE public.inventory_scba_check_entries entry SET equipment_id=asset.id,asset_number=asset.asset_number,location_snapshot=rig.name||' · '||asset.location,
   label=entry.label||' · ID '||asset.asset_number,
   harness_number=CASE WHEN asset.scba_asset_kind='pack' THEN asset.asset_number ELSE NULL END,
   cylinder_number=CASE WHEN asset.scba_asset_kind='bottle' THEN asset.asset_number ELSE NULL END
   WHERE entry.department_id=p_department AND entry.check_id=v_check_id AND entry.equipment_id IS NULL AND entry.section||':'||entry.label=asset.scba_check_slot;
  GET DIAGNOSTICS matches=ROW_COUNT;
  IF matches=0 THEN
   seq:=seq+1;
   INSERT INTO public.inventory_scba_check_entries(department_id,check_id,section,label,sort_order,equipment_id,asset_number,location_snapshot,harness_number,cylinder_number)
    VALUES(p_department,v_check_id,CASE WHEN asset.scba_asset_kind='pack' THEN 'pack' ELSE 'spare' END,asset.name||' · ID '||asset.asset_number,seq,asset.id,asset.asset_number,rig.name||' · '||asset.location,CASE WHEN asset.scba_asset_kind='pack' THEN asset.asset_number ELSE NULL END,CASE WHEN asset.scba_asset_kind='bottle' THEN asset.asset_number ELSE NULL END);
  END IF;
 END LOOP;
 IF seq=0 THEN RAISE EXCEPTION 'Register an air asset or configure the weekly checklist before starting'; END IF;
 RETURN jsonb_build_object('checkId',v_check_id,'resumed',false);
END $$;
REVOKE ALL ON FUNCTION public.inventory_start_air_check(uuid,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.inventory_start_air_check(uuid,uuid,text) TO authenticated;

-- Completed historical maintenance is separate from an open repair or a return-to-service decision.
CREATE FUNCTION public.inventory_log_air_maintenance(p_department uuid,p_equipment uuid,p_id uuid,p_record jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE asset public.inventory_equipment; saved uuid;
BEGIN
 IF NOT private.inventory_can_write(p_department) OR (p_department='14a76771-4c24-481b-8def-e6cce005c17b'::uuid AND NOT private.portal_has_permission('inventory.repairs.manage')) THEN RAISE EXCEPTION 'Repair management permission required' USING ERRCODE='42501'; END IF;
 SELECT * INTO asset FROM public.inventory_equipment WHERE department_id=p_department AND id=p_equipment AND scba_asset_kind IS NOT NULL FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Air asset not found'; END IF;
 IF length(btrim(coalesce(p_record->>'summary',''))) NOT BETWEEN 1 AND 240 OR length(btrim(coalesce(p_record->>'resolution_notes',''))) NOT BETWEEN 1 AND 1000 OR nullif(p_record->>'repair_date','') IS NULL THEN RAISE EXCEPTION 'Service date, summary, and work performed are required'; END IF;
 IF (p_record->>'repair_date')::date > (now() AT TIME ZONE 'America/Chicago')::date THEN RAISE EXCEPTION 'Completed maintenance cannot be dated in the future'; END IF;
 IF nullif(p_record->>'repair_cost','')::numeric < 0 THEN RAISE EXCEPTION 'Cost cannot be negative'; END IF;
 SELECT id INTO saved FROM public.inventory_work_orders WHERE department_id=p_department AND id=p_id AND equipment_id=p_equipment;
 IF FOUND THEN RETURN jsonb_build_object('id',saved,'changed',false); END IF;
 INSERT INTO public.inventory_work_orders(id,department_id,apparatus_id,equipment_id,status,priority,summary,details,opened_by,closed_by,closed_at,repair_date,repair_cost,vendor,invoice_number,resolution_notes,performed_by,service_type,next_service_due_date)
 VALUES(p_id,p_department,asset.apparatus_id,asset.id,'closed','routine',btrim(p_record->>'summary'),p_record->>'resolution_notes',auth.jwt()->>'email',auth.jwt()->>'email',now(),(p_record->>'repair_date')::date,nullif(p_record->>'repair_cost','')::numeric,p_record->>'vendor',p_record->>'invoice_number',p_record->>'resolution_notes',p_record->>'performed_by','other',nullif(p_record->>'next_service_due_date','')::date) RETURNING id INTO saved;
 RETURN jsonb_build_object('id',saved,'changed',true);
END $$;
REVOKE ALL ON FUNCTION public.inventory_log_air_maintenance(uuid,uuid,uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.inventory_log_air_maintenance(uuid,uuid,uuid,jsonb) TO authenticated;
