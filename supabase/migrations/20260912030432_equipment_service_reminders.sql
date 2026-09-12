-- Optional, opt-in service cycles. No records or existing hydro dates are changed.
ALTER TABLE public.inventory_equipment
 ADD COLUMN last_serviced_date date,
 ADD COLUMN service_interval_months integer,
 ADD COLUMN service_reminder_months integer,
 ADD CONSTRAINT inventory_service_schedule_valid CHECK (
   (last_serviced_date IS NULL OR (isfinite(last_serviced_date) AND last_serviced_date >= DATE '1900-01-01')) AND
   ((service_interval_months IS NULL AND service_reminder_months IS NULL) OR
    (last_serviced_date IS NOT NULL AND service_interval_months IS NOT NULL AND service_interval_months BETWEEN 1 AND 600
     AND service_reminder_months IS NOT NULL AND service_reminder_months BETWEEN 0 AND 120 AND service_reminder_months < service_interval_months))
 );

-- Validate changed service dates at write time (not a volatile CHECK constraint).
CREATE FUNCTION private.inventory_validate_service_schedule()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF TG_OP='UPDATE' AND ROW(OLD.last_serviced_date,OLD.service_interval_months,OLD.service_reminder_months)
   IS NOT DISTINCT FROM ROW(NEW.last_serviced_date,NEW.service_interval_months,NEW.service_reminder_months) THEN RETURN NEW; END IF;
 IF NEW.last_serviced_date > (now() AT TIME ZONE 'America/Chicago')::date THEN
   RAISE EXCEPTION 'Last serviced cannot be in the future' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.inventory_validate_service_schedule() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER inventory_validate_service_schedule BEFORE INSERT OR UPDATE OF last_serviced_date,service_interval_months,service_reminder_months
 ON public.inventory_equipment FOR EACH ROW EXECUTE FUNCTION private.inventory_validate_service_schedule();

-- Keep the asset and its service schedule in the same atomic, tenant-scoped save.
CREATE OR REPLACE FUNCTION public.inventory_save_air_asset(p_department uuid,p_id uuid,p_expected_updated_at timestamptz,p_asset jsonb)
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
   last_serviced_date=new_row.last_serviced_date,service_interval_months=new_row.service_interval_months,service_reminder_months=new_row.service_reminder_months,
   hydro_test_date=new_row.hydro_test_date,hydro_due_date=new_row.hydro_due_date,scba_notes=new_row.scba_notes,
   apparatus_id=new_row.apparatus_id,compartment_id=new_row.compartment_id,scba_check_slot=slot,updated_at=clock_timestamp()
   WHERE department_id=p_department AND id=p_id RETURNING * INTO new_row;
 ELSE
  IF p_expected_updated_at IS NOT NULL THEN RAISE EXCEPTION 'The record no longer exists. Refresh the list'; END IF;
  INSERT INTO public.inventory_equipment(id,department_id,apparatus_id,compartment_id,name,scba_asset_kind,asset_number,sku,manufacturer,model,serial_number,barcode,purchase_date,in_service_date,expiration_date,hydro_test_date,hydro_due_date,scba_notes,scba_check_slot,last_serviced_date,service_interval_months,service_reminder_months,quantity_required,item_type,equipment_category,check_types)
   VALUES(p_id,p_department,place.apparatus_id,place.id,new_row.name,new_row.scba_asset_kind,new_row.asset_number,new_row.sku,new_row.manufacturer,new_row.model,new_row.serial_number,new_row.barcode,new_row.purchase_date,new_row.in_service_date,new_row.expiration_date,new_row.hydro_test_date,new_row.hydro_due_date,new_row.scba_notes,slot,new_row.last_serviced_date,new_row.service_interval_months,new_row.service_reminder_months,1,'individual','air_pack',ARRAY['air_pack']) RETURNING * INTO new_row;
 END IF;
 IF new_row.id IS NULL THEN RAISE EXCEPTION 'The record could not be saved'; END IF;
 RETURN jsonb_build_object('id',new_row.id,'changed',true);
END $$;
REVOKE ALL ON FUNCTION public.inventory_save_air_asset(uuid,uuid,timestamptz,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.inventory_save_air_asset(uuid,uuid,timestamptz,jsonb) TO authenticated;
