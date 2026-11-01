-- Keep unfinished originals and their observations; replacements start unanswered.
CREATE TABLE public.inventory_check_archives (
 check_id uuid PRIMARY KEY REFERENCES public.inventory_checks(id) ON DELETE RESTRICT,
 department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE RESTRICT,
 replacement_check_id uuid NOT NULL UNIQUE REFERENCES public.inventory_checks(id) ON DELETE RESTRICT,
 reason text NOT NULL CHECK(length(btrim(reason)) BETWEEN 1 AND 2000),
 archived_at timestamptz NOT NULL DEFAULT now(),
 archived_by text NOT NULL
);
CREATE INDEX inventory_check_archives_department_idx ON public.inventory_check_archives(department_id);
ALTER TABLE public.inventory_check_archives ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.inventory_check_archives FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON public.inventory_check_archives TO authenticated;
CREATE POLICY inventory_check_archives_read ON public.inventory_check_archives FOR SELECT TO authenticated
 USING(EXISTS(SELECT 1 FROM public.inventory_checks c WHERE c.id=check_id AND c.department_id=inventory_check_archives.department_id));
CREATE POLICY inventory_check_archives_insert ON public.inventory_check_archives FOR INSERT TO authenticated
 WITH CHECK(private.inventory_can_admin(department_id));
CREATE POLICY portal_server_boundary ON public.inventory_check_archives AS RESTRICTIVE FOR ALL TO authenticated
 USING(department_id<>'14a76771-4c24-481b-8def-e6cce005c17b' OR (SELECT private.portal_server_request()))
 WITH CHECK(department_id<>'14a76771-4c24-481b-8def-e6cce005c17b' OR (SELECT private.portal_server_request()));

CREATE FUNCTION public.inventory_guard_archive_insert() RETURNS trigger
 LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE original public.inventory_checks%ROWTYPE; replacement public.inventory_checks%ROWTYPE;
BEGIN
 IF auth.uid() IS NULL OR NOT private.inventory_can_admin(NEW.department_id) THEN RAISE EXCEPTION 'Inventory setup permission required' USING ERRCODE='42501'; END IF;
 SELECT * INTO original FROM public.inventory_checks WHERE id=NEW.check_id AND department_id=NEW.department_id;
 SELECT * INTO replacement FROM public.inventory_checks WHERE id=NEW.replacement_check_id AND department_id=NEW.department_id;
 IF original.id IS NULL OR replacement.id IS NULL OR original.status<>'cancelled' OR original.completed_at IS NOT NULL OR original.check_type<>'weekly' OR replacement.check_type<>'weekly' OR original.apparatus_id<>replacement.apparatus_id OR replacement.status<>'in_progress' OR original.id=replacement.id THEN RAISE EXCEPTION 'An archive must link the original unfinished weekly check to its department replacement'; END IF;
 NEW.archived_at:=now();NEW.archived_by:=COALESCE(auth.jwt()->>'email',auth.uid()::text);
 RETURN NEW;
END $$;
CREATE TRIGGER inventory_guard_archive_insert BEFORE INSERT ON public.inventory_check_archives FOR EACH ROW EXECUTE FUNCTION public.inventory_guard_archive_insert();

CREATE FUNCTION public.inventory_guard_archived_check() RETURNS trigger
 LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.inventory_check_archives a WHERE a.check_id=OLD.id AND a.department_id=OLD.department_id) AND NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'Archived unfinished checks are read only'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER inventory_guard_archived_check BEFORE UPDATE ON public.inventory_checks FOR EACH ROW EXECUTE FUNCTION public.inventory_guard_archived_check();
CREATE FUNCTION public.inventory_guard_archived_item() RETURNS trigger
 LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF TG_OP<>'INSERT' AND EXISTS(SELECT 1 FROM public.inventory_check_archives a WHERE a.check_id=OLD.check_id AND a.department_id=OLD.department_id) THEN RAISE EXCEPTION 'Archived check entries are read only'; END IF;
 IF TG_OP<>'DELETE' AND EXISTS(SELECT 1 FROM public.inventory_check_archives a WHERE a.check_id=NEW.check_id AND a.department_id=NEW.department_id) THEN RAISE EXCEPTION 'Archived check entries are read only'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;RETURN NEW;
END $$;
CREATE TRIGGER inventory_guard_archived_item BEFORE INSERT OR UPDATE OR DELETE ON public.inventory_check_items FOR EACH ROW EXECUTE FUNCTION public.inventory_guard_archived_item();

CREATE FUNCTION public.inventory_restart_weekly_check(p_department uuid,p_check uuid,p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE original public.inventory_checks%ROWTYPE; previous public.inventory_check_archives%ROWTYPE; new_id uuid; equipment_ids uuid[]; today date:=(now() AT TIME ZONE 'America/Chicago')::date; saturday date; actor text;
BEGIN
 IF auth.uid() IS NULL OR NOT private.inventory_can_admin(p_department) OR NOT private.inventory_can_write(p_department) THEN RAISE EXCEPTION 'Inventory setup and checking permissions required' USING ERRCODE='42501'; END IF;
 IF p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 1 AND 2000 THEN RAISE EXCEPTION 'Explain why this unfinished check is being replaced'; END IF;
 SELECT * INTO original FROM public.inventory_checks WHERE id=p_check AND department_id=p_department FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'The original check is unavailable for your department' USING ERRCODE='42501'; END IF;
 SELECT * INTO previous FROM public.inventory_check_archives WHERE check_id=p_check AND department_id=p_department;
 IF FOUND THEN RETURN jsonb_build_object('saved',true,'alreadyRestarted',true,'checkId',previous.replacement_check_id,'archivedCheckId',p_check); END IF;
 IF original.check_type<>'weekly' OR original.status<>'in_progress' OR original.completed_at IS NOT NULL THEN RAISE EXCEPTION 'Only an unfinished weekly check can be archived and replaced'; END IF;
 IF EXISTS(SELECT 1 FROM public.department_apparatus WHERE id=original.apparatus_id AND department_id=p_department AND status='out_of_service') THEN RAISE EXCEPTION 'This apparatus is Out of Service; its original check has not been changed'; END IF;
 IF EXISTS(SELECT 1 FROM public.inventory_equipment e JOIN public.inventory_compartments c ON c.id=e.compartment_id AND c.department_id=e.department_id WHERE e.department_id=p_department AND e.apparatus_id=original.apparatus_id AND e.retired_at IS NULL AND 'weekly'=ANY(e.check_types) AND e.meter_template IS NULL AND (e.check_types && ARRAY['inventory','air_pack']::text[] OR c.label='Inventory')) THEN RAISE EXCEPTION 'Remove inventory-only entries from the saved weekly template before replacing this check'; END IF;
 saturday:=today+CASE WHEN extract(dow FROM today)::int=0 THEN -1 ELSE 6-extract(dow FROM today)::int END;
 SELECT array_agg(e.id ORDER BY e.id) INTO equipment_ids FROM public.inventory_equipment e
 WHERE e.department_id=p_department AND e.apparatus_id=original.apparatus_id AND e.retired_at IS NULL AND 'weekly'=ANY(e.check_types)
 AND(e.weekly_recurrence<>'first_third_saturday' OR extract(day FROM saturday) BETWEEN 1 AND 7 OR extract(day FROM saturday) BETWEEN 15 AND 21);
 IF COALESCE(cardinality(equipment_ids),0)=0 THEN RAISE EXCEPTION 'Configure the current weekly mechanical checklist first'; END IF;
 actor:=COALESCE(auth.jwt()->>'email',auth.uid()::text);
 UPDATE public.inventory_checks SET status='cancelled' WHERE id=p_check AND department_id=p_department;
 INSERT INTO public.inventory_checks(department_id,apparatus_id,check_type,status,started_by) VALUES(p_department,original.apparatus_id,'weekly','in_progress',actor) RETURNING id INTO new_id;
 INSERT INTO public.inventory_check_items(department_id,check_id,equipment_id,result) SELECT p_department,new_id,equipment_id,'pending' FROM unnest(equipment_ids) equipment_id;
 INSERT INTO public.inventory_check_archives(check_id,department_id,replacement_check_id,reason,archived_by) VALUES(p_check,p_department,new_id,btrim(p_reason),actor);
 RETURN jsonb_build_object('saved',true,'alreadyRestarted',false,'checkId',new_id,'archivedCheckId',p_check,'itemCount',cardinality(equipment_ids));
END $$;

CREATE OR REPLACE FUNCTION public.inventory_check_history_page(p_department uuid,p_apparatus uuid DEFAULT NULL,p_type text DEFAULT NULL,p_review text DEFAULT NULL,p_from date DEFAULT NULL,p_to date DEFAULT NULL,p_before_time timestamptz DEFAULT NULL,p_before_id uuid DEFAULT NULL)
RETURNS SETOF jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 WITH page AS MATERIALIZED (
  SELECT c.*,a.archived_at,a.archived_by,a.reason AS archive_reason,a.replacement_check_id
  FROM public.inventory_checks c LEFT JOIN public.inventory_check_archives a ON a.check_id=c.id AND a.department_id=c.department_id
  WHERE c.department_id=p_department AND(c.status='completed' OR(c.status='cancelled' AND a.check_id IS NOT NULL))
   AND(p_apparatus IS NULL OR c.apparatus_id=p_apparatus) AND(p_type IS NULL OR c.check_type=p_type)
   AND(p_review IS NULL OR(c.status='completed' AND c.review_status=p_review))
   AND(p_from IS NULL OR COALESCE(c.completed_at,a.archived_at)>=(p_from::timestamp AT TIME ZONE 'America/Chicago'))
   AND(p_to IS NULL OR COALESCE(c.completed_at,a.archived_at)<((p_to+1)::timestamp AT TIME ZONE 'America/Chicago'))
   AND(p_before_time IS NULL OR(c.started_at,c.id)<(p_before_time,p_before_id))
  ORDER BY c.started_at DESC,c.id DESC LIMIT 26
 )
 SELECT to_jsonb(c)||jsonb_build_object('apparatus_name',COALESCE(a.name,''),'item_count',totals.items,'passed_count',totals.passed,'issue_count',totals.issues)
 FROM page c LEFT JOIN public.inventory_apparatus_profiles a ON a.id=c.apparatus_id AND a.department_id=p_department
 CROSS JOIN LATERAL(SELECT count(*) items,count(*) FILTER(WHERE result='pass') passed,count(*) FILTER(WHERE result IN('failed','missing','damaged')) issues
 FROM(SELECT i.result FROM public.inventory_check_items i WHERE i.check_id=c.id AND i.department_id=p_department AND c.check_type<>'air_pack'
 UNION ALL SELECT i.result FROM public.inventory_scba_check_entries i WHERE i.check_id=c.id AND i.department_id=p_department AND c.check_type='air_pack') results) totals
 ORDER BY c.started_at DESC,c.id DESC;
$$;
CREATE OR REPLACE FUNCTION public.inventory_check_report(p_department uuid,p_check uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT jsonb_build_object('check',to_jsonb(c)||jsonb_build_object('apparatus_name',COALESCE(a.name,''),'archived_at',archive.archived_at,'archived_by',archive.archived_by,'archive_reason',archive.reason,'replacement_check_id',archive.replacement_check_id),
 'items',CASE WHEN c.check_type='air_pack' THEN COALESCE((SELECT jsonb_agg(to_jsonb(i)||jsonb_build_object('equipment_name',i.label,'compartment_label',CASE i.section WHEN 'pack' THEN 'SCBA packs' WHEN 'rit' THEN 'R.I.T. bag' ELSE 'Spare bottles' END,'numeric_reading',i.psi) ORDER BY i.sort_order,i.id) FROM public.inventory_scba_check_entries i WHERE i.check_id=c.id AND i.department_id=p_department),'[]'::jsonb)
 ELSE COALESCE((SELECT jsonb_agg(to_jsonb(i)||jsonb_build_object('equipment_name',COALESCE(e.name,''),'compartment_label',COALESCE(location.label,'')) ORDER BY location.sort_order NULLS LAST,e.item_order,i.id)
 FROM public.inventory_check_items i LEFT JOIN public.inventory_equipment e ON e.id=i.equipment_id AND e.department_id=p_department
 LEFT JOIN public.inventory_compartments location ON location.id=e.compartment_id AND location.department_id=p_department
 WHERE i.check_id=c.id AND i.department_id=p_department),'[]'::jsonb) END)
 FROM public.inventory_checks c LEFT JOIN public.inventory_apparatus_profiles a ON a.id=c.apparatus_id AND a.department_id=p_department
 LEFT JOIN public.inventory_check_archives archive ON archive.check_id=c.id AND archive.department_id=p_department
 WHERE c.id=p_check AND c.department_id=p_department AND(c.status='completed' OR(c.status='cancelled' AND archive.check_id IS NOT NULL));
$$;
REVOKE ALL ON FUNCTION public.inventory_guard_archive_insert() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.inventory_guard_archived_check() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.inventory_guard_archived_item() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.inventory_restart_weekly_check(uuid,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.inventory_guard_archive_insert(),public.inventory_guard_archived_check(),public.inventory_guard_archived_item(),public.inventory_restart_weekly_check(uuid,uuid,text) TO authenticated;
