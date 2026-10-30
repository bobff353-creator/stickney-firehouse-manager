-- Aladtec Meter Weekly Inspection (form 458). Additive; historical results stay intact.
ALTER TABLE public.inventory_equipment ADD COLUMN meter_template text;
ALTER TABLE public.inventory_equipment ADD COLUMN meter_template_version integer NOT NULL DEFAULT 0;
ALTER TABLE public.inventory_check_items ADD COLUMN meter_template text;
ALTER TABLE public.inventory_check_items ADD COLUMN meter_response text;
ALTER TABLE public.inventory_check_items ADD COLUMN meter_response_version integer NOT NULL DEFAULT 0;
ALTER TABLE public.inventory_check_items ADD COLUMN meter_photo_id uuid;

CREATE FUNCTION public.inventory_meter_outcome(p_response jsonb, p_complete boolean)
RETURNS text LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $$
DECLARE k text; v text; choices text[]; lights jsonb; actions jsonb; issue boolean; d date;
BEGIN
  IF p_response IS NULL OR jsonb_typeof(p_response) <> 'object' OR octet_length(p_response::text)>12000 THEN
    RAISE EXCEPTION 'Enter valid meter inspection fields'; END IF;
  FOR k IN SELECT jsonb_object_keys(p_response) LOOP
    IF k NOT IN ('inspectionDate','meterId','batteryCharge','stationLights','actions','endOfLife','sensitOperational','sensitLowBattery','memberName','notes') THEN RAISE EXCEPTION 'Unknown meter inspection field'; END IF;
    IF k IN ('stationLights','actions') THEN
      IF jsonb_typeof(p_response->k)<>'array' THEN RAISE EXCEPTION 'Choose valid meter results'; END IF;
      choices := CASE k WHEN 'stationLights' THEN ARRAY['green','yellow','red'] ELSE ARRAY['bumped','calibrated','failed'] END;
      IF jsonb_array_length(p_response->k)>3 OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_response->k) x WHERE jsonb_typeof(x)<>'string' OR NOT (x#>>'{}'=ANY(choices)))
        OR (SELECT count(*)<>count(DISTINCT x) FROM jsonb_array_elements_text(p_response->k) x) THEN RAISE EXCEPTION 'Choose valid meter results'; END IF;
    ELSE
      IF jsonb_typeof(p_response->k)<>'string' THEN RAISE EXCEPTION 'Enter text for meter inspection fields'; END IF;
      v := p_response->>k;
      IF length(v)>(CASE WHEN k='notes' THEN 4000 ELSE 160 END) THEN RAISE EXCEPTION 'Meter inspection field is too long'; END IF;
      IF v<>'' AND ((k='meterId' AND v NOT IN ('M1','M2')) OR (k IN ('batteryCharge','sensitOperational','sensitLowBattery') AND v NOT IN ('yes','no')) OR (k='endOfLife' AND v NOT IN ('none','orange','red'))) THEN RAISE EXCEPTION 'Choose a valid meter result'; END IF;
      IF k='inspectionDate' AND v<>'' THEN
        BEGIN d:=v::date; EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'Enter the actual inspection date'; END;
        IF v !~ '^\d{4}-\d{2}-\d{2}$' OR to_char(d,'YYYY-MM-DD')<>v OR d>(CURRENT_TIMESTAMP AT TIME ZONE 'America/Chicago')::date THEN RAISE EXCEPTION 'Enter the actual inspection date, today or earlier'; END IF;
      END IF;
    END IF;
  END LOOP;
  lights:=COALESCE(p_response->'stationLights','[]'::jsonb); actions:=COALESCE(p_response->'actions','[]'::jsonb);
  IF (lights ? 'green' AND jsonb_array_length(lights)>1) OR (actions ? 'failed' AND jsonb_array_length(actions)>1) THEN RAISE EXCEPTION 'Meter answers contradict each other'; END IF;
  IF p_complete THEN
    FOREACH k IN ARRAY ARRAY['inspectionDate','meterId','batteryCharge','endOfLife','sensitOperational','sensitLowBattery','memberName'] LOOP
      IF NULLIF(btrim(p_response->>k),'') IS NULL THEN RAISE EXCEPTION 'Complete every required meter inspection field'; END IF;
    END LOOP;
    IF jsonb_array_length(lights)=0 OR jsonb_array_length(actions)=0 THEN RAISE EXCEPTION 'Record the station lights and bump or calibration result'; END IF;
  END IF;
  issue:=p_response->>'batteryCharge'='no' OR lights ?| ARRAY['yellow','red'] OR actions ? 'failed' OR p_response->>'endOfLife' IN ('orange','red') OR p_response->>'sensitOperational'='no' OR p_response->>'sensitLowBattery'='yes';
  IF p_complete AND issue AND NULLIF(btrim(p_response->>'notes'),'') IS NULL THEN RAISE EXCEPTION 'Describe the meter issue in comments'; END IF;
  RETURN CASE WHEN NOT p_complete THEN 'pending' WHEN issue THEN 'failed' ELSE 'pass' END;
END $$;
REVOKE ALL ON FUNCTION public.inventory_meter_outcome(jsonb,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.inventory_meter_outcome(jsonb,boolean) TO authenticated;

CREATE FUNCTION public.inventory_guard_meter_item()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE snapshot text; kind text; outcome text;
BEGIN
  SELECT e.meter_template,c.check_type INTO snapshot,kind FROM public.inventory_checks c
    JOIN public.inventory_equipment e ON e.id=NEW.equipment_id AND e.department_id=c.department_id
    WHERE c.id=NEW.check_id AND c.department_id=NEW.department_id;
  IF TG_OP='INSERT' THEN
    NEW.meter_template:=CASE WHEN kind='weekly' THEN snapshot ELSE NULL END;
    IF NEW.meter_template IS NOT NULL AND (NEW.result<>'pending' OR NEW.meter_response IS NOT NULL OR NEW.meter_photo_id IS NOT NULL) THEN RAISE EXCEPTION 'New meter inspection must start unanswered'; END IF;
    NEW.meter_response_version:=0;
  ELSE
    IF OLD.meter_template IS DISTINCT FROM NEW.meter_template AND NOT (OLD.meter_template IS NULL AND OLD.result='pending' AND NEW.result='pending' AND NEW.meter_response IS NULL AND kind='weekly' AND snapshot IS NOT NULL AND NEW.meter_template=snapshot) THEN RAISE EXCEPTION 'Saved meter template snapshot cannot change'; END IF;
    IF OLD.meter_template IS NOT NULL AND (NEW.check_id<>OLD.check_id OR NEW.equipment_id<>OLD.equipment_id OR NEW.department_id<>OLD.department_id) THEN RAISE EXCEPTION 'Saved meter inspection cannot move'; END IF;
    NEW.meter_response_version:=OLD.meter_response_version+CASE WHEN NEW.meter_response IS DISTINCT FROM OLD.meter_response OR NEW.result IS DISTINCT FROM OLD.result OR NEW.meter_photo_id IS DISTINCT FROM OLD.meter_photo_id THEN 1 ELSE 0 END;
  END IF;
  IF NEW.meter_template IS NOT NULL THEN
    outcome:=public.inventory_meter_outcome(COALESCE(NEW.meter_response::jsonb,'{}'::jsonb),NEW.result<>'pending');
    IF NEW.result<>outcome THEN RAISE EXCEPTION 'Use the completed meter form to save this result'; END IF;
    IF NEW.result='failed' AND (NEW.meter_photo_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.inventory_deficiency_photos p JOIN public.inventory_checks c ON c.id=NEW.check_id AND c.department_id=NEW.department_id WHERE p.id=NEW.meter_photo_id AND p.department_id=NEW.department_id AND p.check_item_id=NEW.id AND p.apparatus_id=c.apparatus_id)) THEN RAISE EXCEPTION 'Attach a photo of this meter issue'; END IF;
  ELSIF NEW.meter_response IS NOT NULL OR NEW.meter_photo_id IS NOT NULL THEN RAISE EXCEPTION 'This item has no weekly meter template'; END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.inventory_guard_meter_item() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.inventory_guard_meter_item() TO authenticated;
CREATE TRIGGER inventory_guard_meter_item BEFORE INSERT OR UPDATE ON public.inventory_check_items FOR EACH ROW EXECUTE FUNCTION public.inventory_guard_meter_item();

CREATE FUNCTION public.inventory_save_meter_atomic(p_department_id uuid,p_item_id uuid,p_response text,p_expected_version integer,p_complete boolean,p_notes text,p_photo_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE item public.inventory_check_items%ROWTYPE; inspection public.inventory_checks%ROWTYPE; outcome text; photo uuid; saved jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT private.inventory_can_write(p_department_id) THEN RAISE EXCEPTION 'Inventory writing permission required' USING ERRCODE='42501'; END IF;
  SELECT * INTO item FROM public.inventory_check_items WHERE department_id=p_department_id AND id=p_item_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Meter inspection not found' USING ERRCODE='42501'; END IF;
  SELECT * INTO inspection FROM public.inventory_checks WHERE department_id=p_department_id AND id=item.check_id FOR UPDATE;
  IF NOT FOUND OR inspection.status<>'in_progress' THEN RAISE EXCEPTION 'This weekly inspection is no longer in progress'; END IF;
  SELECT * INTO item FROM public.inventory_check_items WHERE department_id=p_department_id AND id=p_item_id FOR UPDATE;
  IF item.meter_template IS NULL OR inspection.check_type<>'weekly' THEN RAISE EXCEPTION 'Choose a weekly meter inspection'; END IF;
  IF p_expected_version IS NULL OR item.meter_response_version<>p_expected_version THEN RAISE EXCEPTION 'Another crew member saved this entry. Load the latest saved entry before saving.' USING ERRCODE='40001'; END IF;
  IF p_complete IS NULL THEN RAISE EXCEPTION 'Choose draft or completed inspection'; END IF;
  outcome:=public.inventory_meter_outcome(p_response::jsonb,p_complete); photo:=COALESCE(p_photo_id,item.meter_photo_id);
  IF photo IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.inventory_deficiency_photos p WHERE p.id=photo AND p.department_id=p_department_id AND p.apparatus_id=inspection.apparatus_id AND p.check_item_id=p_item_id) THEN RAISE EXCEPTION 'The photo must match this meter inspection'; END IF;
  UPDATE public.inventory_check_items SET meter_response=p_response,meter_photo_id=photo,result='pending',notes=p_notes,checked_by=NULL,checked_at=NULL WHERE id=p_item_id AND department_id=p_department_id;
  IF p_complete THEN
    saved:=public.inventory_record_item_atomic(p_department_id,p_item_id,outcome,p_notes,NULL,photo,ARRAY['equipment'],'{}','{}');
    IF outcome='failed' THEN
      UPDATE public.inventory_work_orders w SET summary='Weekly meter inspection needs attention',details=p_notes
        WHERE w.department_id=p_department_id AND w.status<>'closed' AND w.linked_exception_id IN (SELECT x.id FROM public.inventory_readiness_exceptions x WHERE x.department_id=p_department_id AND x.check_item_id=p_item_id);
    END IF;
    RETURN saved;
  END IF;
  SELECT * INTO item FROM public.inventory_check_items WHERE id=p_item_id AND department_id=p_department_id;
  RETURN jsonb_build_object('saved',true,'checkItems',jsonb_build_array(to_jsonb(item)));
END $$;
REVOKE ALL ON FUNCTION public.inventory_save_meter_atomic(uuid,uuid,text,integer,boolean,text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.inventory_save_meter_atomic(uuid,uuid,text,integer,boolean,text,uuid) TO authenticated;

CREATE FUNCTION public.inventory_save_meter_template(p_department_id uuid,p_equipment_id uuid,p_expected_version integer,p_title text,p_instructions text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE equipment public.inventory_equipment%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT private.inventory_can_admin(p_department_id) THEN RAISE EXCEPTION 'Checklist administration permission required' USING ERRCODE='42501'; END IF;
  SELECT * INTO equipment FROM public.inventory_equipment WHERE department_id=p_department_id AND id=p_equipment_id AND retired_at IS NULL FOR UPDATE;
  IF NOT FOUND OR equipment.meter_template IS NULL THEN RAISE EXCEPTION 'Meter template not found' USING ERRCODE='42501'; END IF;
  IF p_expected_version IS NULL OR equipment.meter_template_version<>p_expected_version THEN RAISE EXCEPTION 'This template changed. Refresh before editing again.' USING ERRCODE='40001'; END IF;
  IF NULLIF(btrim(p_title),'') IS NULL OR length(p_title)>100 OR p_instructions IS NULL OR length(p_instructions)>2000 THEN RAISE EXCEPTION 'Enter a heading and instructions within their limits'; END IF;
  UPDATE public.inventory_equipment SET meter_template=(meter_template::jsonb || jsonb_build_object('title',btrim(p_title),'instructions',btrim(p_instructions)))::text,meter_template_version=meter_template_version+1
    WHERE id=p_equipment_id AND department_id=p_department_id RETURNING * INTO equipment;
  RETURN to_jsonb(equipment);
END $$;
REVOKE ALL ON FUNCTION public.inventory_save_meter_template(uuid,uuid,integer,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.inventory_save_meter_template(uuid,uuid,integer,text,text) TO authenticated;

-- Resolve existing, verified source inventory rows; no new physical asset or schedule.
DO $$
DECLARE target record; n integer;
BEGIN
  FOR target IN SELECT * FROM (VALUES ('1203','frontline-251-023'),('1204','form-439-023')) AS x(apparatus_name,source_key) LOOP
    SELECT count(*) INTO n FROM public.inventory_equipment e JOIN public.inventory_apparatus_profiles a ON a.id=e.apparatus_id AND a.department_id=e.department_id JOIN public.departments d ON d.id=e.department_id
      WHERE d.name='Stickney Fire Department' AND a.name=target.apparatus_name AND e.source_key=target.source_key AND e.name='5 gas meter (fully charged)' AND e.retired_at IS NULL;
    IF n<>1 THEN RAISE EXCEPTION 'Expected one existing meter inventory record for %',target.apparatus_name; END IF;
    UPDATE public.inventory_equipment e SET check_types=CASE WHEN 'weekly'=ANY(check_types) THEN check_types ELSE array_append(check_types,'weekly') END,
      meter_template=jsonb_build_object('version',1,'title','Weekly meter inspection','instructions','Record the actual MSA Altair 5 gas meter and Sensit observations. Complete this with the apparatus weekly check.','source','Aladtec Meter Weekly Inspection · Form 458')::text,meter_template_version=1
      FROM public.inventory_apparatus_profiles a,public.departments d WHERE a.id=e.apparatus_id AND a.department_id=e.department_id AND d.id=e.department_id AND d.name='Stickney Fire Department' AND a.name=target.apparatus_name AND e.source_key=target.source_key AND e.name='5 gas meter (fully charged)' AND e.retired_at IS NULL;
  END LOOP;
END $$;
-- Only unrecorded items in current weekly checks receive the new snapshot.
UPDATE public.inventory_check_items i SET meter_template=e.meter_template FROM public.inventory_equipment e,public.inventory_checks c
  WHERE e.id=i.equipment_id AND e.department_id=i.department_id AND e.meter_template IS NOT NULL AND c.id=i.check_id AND c.department_id=i.department_id AND c.check_type='weekly' AND c.status='in_progress' AND i.result='pending' AND i.meter_template IS NULL;
INSERT INTO public.inventory_check_items(department_id,check_id,equipment_id,result)
  SELECT c.department_id,c.id,e.id,'pending' FROM public.inventory_checks c JOIN public.inventory_equipment e ON e.department_id=c.department_id AND e.apparatus_id=c.apparatus_id
  WHERE c.check_type='weekly' AND c.status='in_progress' AND e.meter_template IS NOT NULL AND e.retired_at IS NULL
  AND NOT EXISTS(SELECT 1 FROM public.inventory_check_items i WHERE i.check_id=c.id AND i.equipment_id=e.id);
