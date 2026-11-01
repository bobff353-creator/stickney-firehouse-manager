-- New drug checks reuse inventory permissions, history, findings and officer review.
ALTER TABLE public.inventory_checks DROP CONSTRAINT inventory_checks_check_type_check;
ALTER TABLE public.inventory_checks ADD CONSTRAINT inventory_checks_check_type_check CHECK(check_type IN ('daily','weekly','inventory','air_pack','drug'));
ALTER TABLE public.inventory_inspection_schedules DROP CONSTRAINT inventory_inspection_schedules_check_type_check;
ALTER TABLE public.inventory_inspection_schedules ADD CONSTRAINT inventory_inspection_schedules_check_type_check CHECK(check_type IN ('daily','weekly','inventory','air_pack','drug'));
ALTER TABLE public.inventory_equipment DROP CONSTRAINT inventory_equipment_response_type_check;
ALTER TABLE public.inventory_equipment ADD CONSTRAINT inventory_equipment_response_type_check CHECK(response_type IN ('pass_fail','quantity','expiration_date','numeric','mileage','text','medication'));
ALTER TABLE public.inventory_check_items ADD COLUMN drug_schema text;
ALTER TABLE public.inventory_check_items ADD COLUMN drug_response text;
ALTER TABLE public.inventory_check_items ADD COLUMN drug_response_version integer NOT NULL DEFAULT 0;
ALTER TABLE public.inventory_check_items ADD COLUMN drug_photo_id uuid;

CREATE FUNCTION public.inventory_drug_outcome(s jsonb,r jsonb,complete boolean)
RETURNS text LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE k text; v text; mode text; condition text; quantity integer; expected integer; d date; issue boolean; today date:=(now() AT TIME ZONE 'America/Chicago')::date;
BEGIN
 IF s IS NULL OR COALESCE(s->>'version','')<>'1' OR r IS NULL OR jsonb_typeof(r)<>'object' OR octet_length(r::text)>24000 OR complete IS NULL THEN RAISE EXCEPTION 'Enter valid drug inventory fields'; END IF;
 mode:=s->>'mode';expected:=(s->>'expectedQuantity')::integer;
 IF mode IS NULL OR mode NOT IN ('medication','pass_fail','quantity','expiration_date','numeric','mileage','text') OR expected IS NULL OR expected NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Review the saved logging format'; END IF;
 FOR k IN SELECT jsonb_object_keys(r) LOOP
  IF k NOT IN ('condition','count','expirations','locations','value','notes') THEN RAISE EXCEPTION 'Unknown drug inventory field'; END IF;
  IF k IN ('expirations','locations') THEN
   IF jsonb_typeof(r->k)<>'array' OR jsonb_array_length(r->k)>100 OR EXISTS(SELECT 1 FROM jsonb_array_elements(r->k) x WHERE jsonb_typeof(x)<>'string' OR length(x#>>'{}')>(CASE WHEN k='locations' THEN 240 ELSE 10 END)) THEN RAISE EXCEPTION 'Enter valid container observations'; END IF;
  ELSIF jsonb_typeof(r->k)<>'string' OR length(r->>k)>(CASE WHEN k IN ('notes','value') THEN 4000 ELSE 30 END) THEN RAISE EXCEPTION 'Enter valid text observations'; END IF;
 END LOOP;
 condition:=COALESCE(r->>'condition','');
 IF condition NOT IN ('','satisfactory','issue','not_applicable') THEN RAISE EXCEPTION 'Choose the observed result'; END IF;
 IF COALESCE(r->>'count','')<>'' THEN
  IF r->>'count' !~ '^[0-9]{1,3}$' OR (r->>'count')::integer>100 THEN RAISE EXCEPTION 'Enter a whole count from 0 to 100'; END IF;
  quantity:=(r->>'count')::integer;
 END IF;
 IF mode IN ('numeric','mileage') AND COALESCE(r->>'value','')<>'' AND (r->>'value' !~ '^([0-9]+([.][0-9]*)?|[.][0-9]+)$' OR (r->>'value')::numeric<0) THEN RAISE EXCEPTION 'Enter a nonnegative numeric reading'; END IF;
 FOR v IN SELECT value FROM jsonb_array_elements_text(COALESCE(r->'expirations','[]'::jsonb)) UNION ALL SELECT r->>'value' WHERE mode='expiration_date' LOOP
  IF COALESCE(v,'')<>'' AND v<>'unknown' THEN
   IF v !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN RAISE EXCEPTION 'Enter a valid expiration date'; END IF;
   BEGIN d:=v::date; EXCEPTION WHEN datetime_field_overflow OR invalid_datetime_format THEN RAISE EXCEPTION 'Enter a valid expiration date'; END;
   IF to_char(d,'YYYY-MM-DD')<>v THEN RAISE EXCEPTION 'Enter a valid expiration date'; END IF;
  END IF;
 END LOOP;
 issue:=condition='issue';
 IF mode='medication' AND EXISTS(SELECT 1 FROM jsonb_array_elements_text(COALESCE(r->'locations','[]'::jsonb)) x WHERE btrim(x)<>'' AND lower(btrim(x))<>lower(btrim(s->>'location'))) THEN issue:=true; END IF;
 IF mode IN ('medication','quantity') AND quantity<expected THEN issue:=true; END IF;
 FOR v IN SELECT value FROM jsonb_array_elements_text(COALESCE(r->'expirations','[]'::jsonb)) WHERE mode='medication' UNION ALL SELECT r->>'value' WHERE mode='expiration_date' LOOP
  IF v='unknown' THEN issue:=true; ELSIF COALESCE(v,'')<>'' AND v::date<today THEN issue:=true; END IF;
 END LOOP;
 IF NOT complete THEN RETURN 'pending'; END IF;
 IF condition='' THEN RAISE EXCEPTION 'Choose the observed result'; END IF;
 IF condition='satisfactory' THEN
  IF mode IN ('medication','quantity') AND quantity IS NULL THEN RAISE EXCEPTION 'Enter the actual quantity counted'; END IF;
  IF mode='medication' AND (jsonb_array_length(COALESCE(r->'expirations','[]'::jsonb))<>quantity OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(COALESCE(r->'expirations','[]'::jsonb)) x WHERE x='') OR jsonb_array_length(COALESCE(r->'locations','[]'::jsonb))<>quantity OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(COALESCE(r->'locations','[]'::jsonb)) x WHERE btrim(x)='')) THEN RAISE EXCEPTION 'Record an expiration and location for every container present'; END IF;
  IF mode IN ('numeric','mileage','text','expiration_date') AND NULLIF(btrim(r->>'value'),'') IS NULL THEN RAISE EXCEPTION 'Record the required reading'; END IF;
 END IF;
 IF (issue OR condition='not_applicable') AND NULLIF(btrim(r->>'notes'),'') IS NULL THEN RAISE EXCEPTION 'Explain the issue or why this item does not apply'; END IF;
 RETURN CASE WHEN condition='not_applicable' THEN 'not_applicable' WHEN issue THEN CASE WHEN mode IN ('medication','quantity') AND quantity=0 THEN 'missing' ELSE 'failed' END ELSE 'pass' END;
END $$;
REVOKE ALL ON FUNCTION public.inventory_drug_outcome(jsonb,jsonb,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.inventory_drug_outcome(jsonb,jsonb,boolean) TO authenticated;

CREATE FUNCTION public.inventory_guard_drug_item()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE inspection public.inventory_checks%ROWTYPE; equipment public.inventory_equipment%ROWTYPE; expected text; location text; outcome text;
BEGIN
 SELECT * INTO inspection FROM public.inventory_checks WHERE id=NEW.check_id AND department_id=NEW.department_id;
 IF TG_OP='INSERT' THEN
  SELECT * INTO equipment FROM public.inventory_equipment WHERE id=NEW.equipment_id AND department_id=NEW.department_id;
  IF inspection.check_type='drug' OR equipment.response_type='medication' THEN
   SELECT p.name||' · '||c.label INTO location FROM public.inventory_compartments c JOIN public.inventory_apparatus_profiles p ON p.id=c.apparatus_id AND p.department_id=c.department_id WHERE c.id=equipment.compartment_id AND c.department_id=NEW.department_id;
   NEW.drug_schema:=jsonb_build_object('version',1,'title',equipment.name,'mode',equipment.response_type,'expectedQuantity',equipment.quantity_required,'location',COALESCE(location,''))::text;
   IF NEW.result<>'pending' OR NEW.drug_response IS NOT NULL OR NEW.drug_photo_id IS NOT NULL THEN RAISE EXCEPTION 'New drug observations must start unanswered'; END IF;
  ELSE NEW.drug_schema:=NULL; END IF;
  NEW.drug_response_version:=0;
 ELSE
  IF NEW.drug_schema IS DISTINCT FROM OLD.drug_schema THEN RAISE EXCEPTION 'Saved logging format cannot change'; END IF;
  IF OLD.drug_schema IS NOT NULL AND (NEW.department_id<>OLD.department_id OR NEW.check_id<>OLD.check_id OR NEW.equipment_id<>OLD.equipment_id OR inspection.status<>'in_progress') THEN RAISE EXCEPTION 'Saved drug observations cannot move or change after completion'; END IF;
  NEW.drug_response_version:=OLD.drug_response_version+CASE WHEN NEW.drug_response IS DISTINCT FROM OLD.drug_response OR NEW.result IS DISTINCT FROM OLD.result OR NEW.drug_photo_id IS DISTINCT FROM OLD.drug_photo_id THEN 1 ELSE 0 END;
 END IF;
 IF NEW.drug_schema IS NOT NULL THEN
  outcome:=public.inventory_drug_outcome(NEW.drug_schema::jsonb,COALESCE(NEW.drug_response::jsonb,'{}'::jsonb),NEW.result<>'pending');
  IF NEW.result<>outcome THEN RAISE EXCEPTION 'Complete the saved drug logging fields to save this result'; END IF;
  IF NEW.result IN ('failed','missing','damaged') AND (NEW.drug_photo_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.inventory_deficiency_photos p WHERE p.id=NEW.drug_photo_id AND p.department_id=NEW.department_id AND p.apparatus_id=inspection.apparatus_id AND p.check_item_id=NEW.id)) THEN RAISE EXCEPTION 'Attach a photo documenting this drug inventory issue'; END IF;
 ELSIF NEW.drug_response IS NOT NULL OR NEW.drug_photo_id IS NOT NULL THEN RAISE EXCEPTION 'This item has no saved drug logging format'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.inventory_guard_drug_item() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.inventory_guard_drug_item() TO authenticated;
CREATE TRIGGER inventory_guard_drug_item BEFORE INSERT OR UPDATE ON public.inventory_check_items FOR EACH ROW EXECUTE FUNCTION public.inventory_guard_drug_item();

CREATE FUNCTION public.inventory_save_drug_atomic(p_department_id uuid,p_item_id uuid,p_response text,p_expected_version integer,p_complete boolean,p_photo_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE item public.inventory_check_items%ROWTYPE; inspection public.inventory_checks%ROWTYPE; r jsonb; s jsonb; outcome text; photo uuid; v_notes text; actor text; exception_id uuid; v_priority text; dates text; locations text;
BEGIN
 IF auth.uid() IS NULL OR NOT private.inventory_can_write(p_department_id) THEN RAISE EXCEPTION 'Inventory writing permission required' USING ERRCODE='42501'; END IF;
 SELECT * INTO item FROM public.inventory_check_items WHERE id=p_item_id AND department_id=p_department_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Drug check item not found' USING ERRCODE='42501'; END IF;
 SELECT * INTO inspection FROM public.inventory_checks WHERE id=item.check_id AND department_id=p_department_id FOR UPDATE;
 IF NOT FOUND OR inspection.status<>'in_progress' THEN RAISE EXCEPTION 'This check is no longer in progress'; END IF;
 SELECT * INTO item FROM public.inventory_check_items WHERE id=p_item_id AND department_id=p_department_id FOR UPDATE;
 IF item.drug_schema IS NULL THEN RAISE EXCEPTION 'Choose a saved drug check item'; END IF;
 IF p_expected_version IS NULL OR item.drug_response_version<>p_expected_version THEN RAISE EXCEPTION 'Another crew member saved this entry. Refresh and compare the latest saved entry.' USING ERRCODE='40001'; END IF;
 r:=p_response::jsonb;s:=item.drug_schema::jsonb;outcome:=public.inventory_drug_outcome(s,r,p_complete);photo:=COALESCE(p_photo_id,item.drug_photo_id);
 IF photo IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.inventory_deficiency_photos p WHERE p.id=photo AND p.department_id=p_department_id AND p.apparatus_id=inspection.apparatus_id AND p.check_item_id=item.id) THEN RAISE EXCEPTION 'The issue photo must match this check item'; END IF;
 SELECT string_agg('Container '||ord||' expiration: '||CASE value WHEN 'unknown' THEN 'Unable to verify' WHEN '' THEN 'Not recorded' ELSE value END,E'\n' ORDER BY ord) INTO dates FROM jsonb_array_elements_text(COALESCE(r->'expirations','[]'::jsonb)) WITH ORDINALITY x(value,ord) WHERE s->>'mode'='medication';
 SELECT string_agg('Container '||ord||' observed location: '||COALESCE(NULLIF(value,''),'Not recorded'),E'\n' ORDER BY ord) INTO locations FROM jsonb_array_elements_text(COALESCE(r->'locations','[]'::jsonb)) WITH ORDINALITY x(value,ord) WHERE s->>'mode'='medication';
 v_notes:=concat_ws(E'\n',s->>'title','Observed result: '||COALESCE(NULLIF(replace(r->>'condition','_',' '),''),'Not recorded'),CASE WHEN s->>'mode' IN ('medication','quantity') THEN 'Quantity counted: '||COALESCE(NULLIF(r->>'count',''),'Not recorded')||'; required '||(s->>'expectedQuantity') END,dates,locations,CASE WHEN s->>'mode' IN ('text','numeric','mileage','expiration_date') THEN 'Reading: '||CASE WHEN r->>'value'='unknown' THEN 'Unable to verify' ELSE COALESCE(NULLIF(r->>'value',''),'Not recorded') END END,CASE WHEN NULLIF(btrim(r->>'notes'),'') IS NOT NULL THEN 'Comments: '||btrim(r->>'notes') END);
 actor:=COALESCE(auth.jwt()->>'email',auth.uid()::text);
 UPDATE public.inventory_check_items SET drug_response=p_response,drug_photo_id=photo,result=outcome,notes=v_notes,numeric_reading=CASE WHEN s->>'mode' IN ('numeric','mileage') AND COALESCE(r->>'value','')<>'' THEN (r->>'value')::numeric ELSE NULL END,checked_by=CASE WHEN p_complete THEN actor ELSE NULL END,checked_at=CASE WHEN p_complete THEN now() ELSE NULL END WHERE id=item.id AND department_id=p_department_id RETURNING * INTO item;
 IF outcome IN ('failed','missing','damaged') THEN
  v_priority:=CASE WHEN outcome='missing' THEN 'high' ELSE 'medium' END;
  IF (SELECT count(*) FROM public.inventory_readiness_exceptions WHERE department_id=p_department_id AND check_item_id=item.id AND status<>'resolved')>1 THEN RAISE EXCEPTION 'Multiple open findings need administrator review'; END IF;
  SELECT id INTO exception_id FROM public.inventory_readiness_exceptions WHERE department_id=p_department_id AND check_item_id=item.id AND status<>'resolved' FOR UPDATE;
  IF exception_id IS NULL THEN
   INSERT INTO public.inventory_readiness_exceptions(department_id,apparatus_id,equipment_id,check_item_id,result,priority,notes,status,out_of_service,opened_by,issue_categories,assigned_employee_ids,assigned_employee_names,evidence_photo_id) VALUES(p_department_id,inspection.apparatus_id,item.equipment_id,item.id,outcome,v_priority,v_notes,'open',false,actor,ARRAY['equipment'],'{}','{}',photo) RETURNING id INTO exception_id;
  ELSE UPDATE public.inventory_readiness_exceptions SET result=outcome,priority=v_priority,notes=v_notes,evidence_photo_id=photo WHERE id=exception_id AND department_id=p_department_id; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.inventory_work_orders WHERE department_id=p_department_id AND linked_exception_id=exception_id AND status<>'closed') THEN
   INSERT INTO public.inventory_work_orders(department_id,apparatus_id,equipment_id,linked_exception_id,status,priority,summary,details,opened_by) VALUES(p_department_id,inspection.apparatus_id,item.equipment_id,exception_id,'new',v_priority,'Drug inventory needs attention: '||(s->>'title'),v_notes,actor);
  END IF;
 END IF;
 RETURN jsonb_build_object('saved',true,'checkItems',jsonb_build_array(to_jsonb(item)));
END $$;
REVOKE ALL ON FUNCTION public.inventory_save_drug_atomic(uuid,uuid,text,integer,boolean,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.inventory_save_drug_atomic(uuid,uuid,text,integer,boolean,uuid) TO authenticated;
