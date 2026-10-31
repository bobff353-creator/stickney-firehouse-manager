-- Disciplinary reports use the existing rank settings and employee overrides.
-- Existing grants, overrides, records and private modules are retained.
CREATE OR REPLACE FUNCTION private.portal_has_permission(permission text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE actor_email text; employee record; match_count int; override_effect text; saved boolean; base text[];
BEGIN
  IF NOT private.portal_server_request() OR NOT firehouse.has_department_access() THEN RETURN false; END IF;
  IF NOT permission = ANY(ARRAY['dashboard.view','operations_board.view','road_closures.view','command_center.view','daily_log.view','daily_log.manage','field_preplans.view','field_preplans.edit','field_preplans.publish','field_preplans.delete','field_preplans.review','field_preplans.manage_layers','field_preplans.manage_hazmat','field_preplans.manage_attachments','field_preplans.verify_expiring','field_preplans.manage_settings','incident_command.view','incident_command.manage','safety_inspections.view','safety_inspections.complete','safety_inspections.manage','scheduling.view','scheduling.manage','payroll.view_own','payroll.manage','employees.view','employees.manage','contacts.view','documents.view','policies.manage','box_cards.manage','inventory.view','inventory.check','inventory.repairs.manage','disciplinary.manage','inventory.setup.manage','settings.manage','permissions.manage']) THEN RETURN false; END IF;
  SELECT lower(btrim(email)) INTO actor_email FROM auth.users WHERE id=(SELECT auth.uid());
  IF actor_email='bobff353@gmail.com' THEN RETURN true; END IF;
  SELECT count(*) INTO match_count FROM firehouse.employees e JOIN firehouse.employee_profiles ep ON ep.employee_id=e.id
    WHERE e.id=firehouse.employee_id_for_login(actor_email);
  IF match_count<>1 THEN RETURN false; END IF;
  SELECT e.id,p.label rank,COALESCE(ep.is_admin,0) is_admin,ep.end_date INTO employee
    FROM firehouse.employees e JOIN firehouse.pay_scales p ON p.id=e.pay_scale_id JOIN firehouse.employee_profiles ep ON ep.employee_id=e.id
    WHERE e.id=firehouse.employee_id_for_login(actor_email);
  IF employee.end_date IS NOT NULL AND employee.end_date<>'' AND employee.end_date<to_char(now() AT TIME ZONE 'America/Chicago','YYYY-MM-DD') THEN RETURN false; END IF;
  IF permission='payroll.view_own' THEN RETURN true; END IF;
  SELECT effect INTO override_effect FROM firehouse.employee_permission_overrides WHERE employee_id=employee.id AND permission_key=permission;
  IF override_effect='deny' THEN RETURN false; END IF;
  IF override_effect='allow' THEN RETURN true; END IF;
  IF employee.is_admin=1 THEN RETURN true; END IF;
  -- Board access is opt-in per member; old rank grants are retained but ignored.
  IF permission='operations_board.view' THEN RETURN false; END IF;
  SELECT allowed=1 INTO saved FROM firehouse.rank_permissions WHERE rank=employee.rank AND permission_key=permission;
  IF FOUND THEN RETURN saved; END IF;
  IF lower(employee.rank) LIKE '%chief%' THEN base:=ARRAY['dashboard.view','road_closures.view','command_center.view','daily_log.view','daily_log.manage','field_preplans.view','field_preplans.edit','field_preplans.publish','field_preplans.delete','field_preplans.review','field_preplans.manage_layers','field_preplans.manage_hazmat','field_preplans.manage_attachments','field_preplans.verify_expiring','field_preplans.manage_settings','incident_command.view','incident_command.manage','safety_inspections.view','safety_inspections.complete','safety_inspections.manage','scheduling.view','scheduling.manage','payroll.view_own','payroll.manage','employees.view','employees.manage','contacts.view','documents.view','policies.manage','box_cards.manage','inventory.view','inventory.check','inventory.repairs.manage','disciplinary.manage','inventory.setup.manage','settings.manage','permissions.manage'];
  ELSIF lower(employee.rank) LIKE '%captain%' OR lower(employee.rank) LIKE '%lieutenant%' THEN base:=ARRAY['dashboard.view','road_closures.view','scheduling.view','payroll.view_own','documents.view','field_preplans.view','safety_inspections.view','safety_inspections.complete','inventory.view','inventory.check','daily_log.view','daily_log.manage','field_preplans.edit','incident_command.view','field_preplans.review','field_preplans.verify_expiring','employees.view','contacts.view','incident_command.manage','safety_inspections.manage','inventory.repairs.manage','disciplinary.manage','command_center.view','scheduling.manage'];
  ELSIF lower(employee.rank) LIKE '%firefighter%' OR lower(btrim(employee.rank))='ff' THEN base:=ARRAY['dashboard.view','road_closures.view','scheduling.view','payroll.view_own','documents.view','field_preplans.view','safety_inspections.view','safety_inspections.complete','inventory.view','inventory.check','daily_log.view','daily_log.manage','field_preplans.edit','incident_command.view'];
  ELSE base:=ARRAY['dashboard.view','road_closures.view','scheduling.view','payroll.view_own','documents.view','field_preplans.view','safety_inspections.view','safety_inspections.complete','inventory.view','inventory.check']; END IF;
  RETURN permission=ANY(base);
END $function$
;

CREATE FUNCTION public.disciplinary_access(p_department uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.departments d WHERE d.id=p_department AND d.slug='stickney-fire-department')
 AND (SELECT private.portal_has_permission('disciplinary.manage'))
$$;
REVOKE ALL ON FUNCTION public.disciplinary_access(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.disciplinary_access(uuid) TO authenticated;

CREATE TABLE public.disciplinary_reports(
 id uuid PRIMARY KEY,department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE RESTRICT,
 content jsonb NOT NULL,status text NOT NULL CHECK(status IN ('draft','submitted')),version integer NOT NULL CHECK(version>0),
 change_reason text NOT NULL DEFAULT '',created_by uuid NOT NULL,created_by_name text NOT NULL,updated_by uuid NOT NULL,updated_by_name text NOT NULL,
 created_at timestamptz NOT NULL,updated_at timestamptz NOT NULL,submitted_at timestamptz,
 last_operation_id uuid NOT NULL,last_request_hash text NOT NULL,
 UNIQUE(id,department_id)
);
CREATE INDEX disciplinary_reports_department_updated ON public.disciplinary_reports(department_id,updated_at DESC,id DESC);
CREATE TABLE public.disciplinary_report_versions(
 report_id uuid NOT NULL,department_id uuid NOT NULL,version integer NOT NULL,content jsonb NOT NULL,status text NOT NULL,
 change_reason text NOT NULL,actor_id uuid NOT NULL,actor_name text NOT NULL,saved_at timestamptz NOT NULL,
 PRIMARY KEY(report_id,version),FOREIGN KEY(report_id,department_id) REFERENCES public.disciplinary_reports(id,department_id) ON DELETE RESTRICT
);
CREATE INDEX disciplinary_versions_department_report ON public.disciplinary_report_versions(department_id,report_id,version DESC);
CREATE TABLE public.disciplinary_report_files(
 id uuid PRIMARY KEY,department_id uuid NOT NULL,report_id uuid NOT NULL,object_key text NOT NULL UNIQUE,
 original_filename text NOT NULL,mime_type text NOT NULL,byte_size bigint NOT NULL CHECK(byte_size>0 AND byte_size<=4194304),sha256 text NOT NULL CHECK(sha256~'^[a-f0-9]{64}$'),
 uploaded_by uuid NOT NULL DEFAULT auth.uid(),uploaded_by_name text NOT NULL,uploaded_at timestamptz NOT NULL DEFAULT now(),UNIQUE(report_id,sha256),
 FOREIGN KEY(report_id,department_id) REFERENCES public.disciplinary_reports(id,department_id) ON DELETE RESTRICT
);
CREATE INDEX disciplinary_files_department_report ON public.disciplinary_report_files(department_id,report_id);
ALTER TABLE public.disciplinary_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disciplinary_report_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disciplinary_report_files ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.disciplinary_reports,public.disciplinary_report_versions,public.disciplinary_report_files FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.disciplinary_reports TO authenticated;
GRANT SELECT ON public.disciplinary_report_versions TO authenticated;
GRANT SELECT,INSERT ON public.disciplinary_report_files TO authenticated;
CREATE POLICY disciplinary_reports_read ON public.disciplinary_reports FOR SELECT TO authenticated USING(public.disciplinary_access(department_id));
CREATE POLICY disciplinary_reports_insert ON public.disciplinary_reports FOR INSERT TO authenticated WITH CHECK(public.disciplinary_access(department_id) AND created_by=(SELECT auth.uid()));
CREATE POLICY disciplinary_reports_update ON public.disciplinary_reports FOR UPDATE TO authenticated USING(public.disciplinary_access(department_id)) WITH CHECK(public.disciplinary_access(department_id));
CREATE POLICY disciplinary_versions_read ON public.disciplinary_report_versions FOR SELECT TO authenticated USING(public.disciplinary_access(department_id));
CREATE POLICY disciplinary_files_read ON public.disciplinary_report_files FOR SELECT TO authenticated USING(public.disciplinary_access(department_id));
CREATE POLICY disciplinary_files_insert ON public.disciplinary_report_files FOR INSERT TO authenticated WITH CHECK(public.disciplinary_access(department_id) AND uploaded_by=(SELECT auth.uid()) AND object_key LIKE department_id::text||'/'||report_id::text||'/'||id::text||'.%');

CREATE FUNCTION private.disciplinary_guard_report() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c jsonb; k text; v text; choices text[]; actor text; actor_email text; person_name text; supervisor_name text; signed jsonb; prior_signed jsonb; signature jsonb; d date; body_changed boolean;
BEGIN
 IF auth.uid() IS NULL OR NOT public.disciplinary_access(NEW.department_id) THEN RAISE EXCEPTION 'Disciplinary access required' USING ERRCODE='42501'; END IF;
 SELECT lower(email) INTO actor_email FROM auth.users WHERE id=auth.uid();
 SELECT name INTO actor FROM firehouse.employees WHERE id=firehouse.employee_id_for_login(actor_email);
 actor:=COALESCE(actor,actor_email);
 c:=NEW.content;
 IF c IS NULL OR jsonb_typeof(c)<>'object' OR octet_length(c::text)>900000 OR c->'schemaVersion' IS DISTINCT FROM '1'::jsonb THEN RAISE EXCEPTION 'Enter a valid disciplinary report'; END IF;
 FOR k IN SELECT jsonb_object_keys(c) LOOP
   IF k NOT IN ('schemaVersion','employeeId','employeeName','supervisorId','supervisorName','incidentDate','incidentTime','incidentNumber','disciplineStep','previousDiscipline','factors','details','correctiveActions','documentationProvided','employeeResponse','employeeComments','fileIds','signatures') THEN RAISE EXCEPTION 'Unknown report field'; END IF;
 END LOOP;
 FOREACH k IN ARRAY ARRAY['employeeId','supervisorId','incidentDate','incidentTime','incidentNumber','disciplineStep','previousDiscipline','details','correctiveActions','documentationProvided','employeeResponse','employeeComments'] LOOP
   IF jsonb_typeof(c->k) IS DISTINCT FROM 'string' OR length(c->>k)>(CASE WHEN k IN ('details','correctiveActions','employeeComments') THEN 12000 ELSE 160 END) THEN RAISE EXCEPTION 'Enter report text within its displayed limit'; END IF;
   IF NEW.status='submitted' AND k IN ('employeeId','supervisorId','incidentDate','disciplineStep','previousDiscipline','details','documentationProvided','employeeResponse') AND NULLIF(btrim(c->>k),'') IS NULL THEN RAISE EXCEPTION 'Complete every required report field before submitting'; END IF;
 END LOOP;
 IF c->>'incidentDate'<>'' THEN
   BEGIN d:=(c->>'incidentDate')::date; EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'Enter the actual incident date'; END;
   IF c->>'incidentDate'!~'^\d{4}-\d{2}-\d{2}$' OR to_char(d,'YYYY-MM-DD')<>c->>'incidentDate' OR d>(now() AT TIME ZONE 'America/Chicago')::date THEN RAISE EXCEPTION 'Enter the actual incident date, today or earlier'; END IF;
 END IF;
 IF c->>'incidentTime'<>'' AND c->>'incidentTime'!~'^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN RAISE EXCEPTION 'Enter a valid incident time'; END IF;
 FOREACH k IN ARRAY ARRAY['disciplineStep','previousDiscipline','documentationProvided','employeeResponse'] LOOP
   choices:=CASE k WHEN 'disciplineStep' THEN ARRAY['Verbal Counseling, Non-documented','Verbal Counseling, Documented','Written Reprimand','Suspension','Termination'] WHEN 'previousDiscipline' THEN ARRAY['No','Yes, unrelated','Yes, related'] WHEN 'documentationProvided' THEN ARRAY['Yes, in print','Yes, electronically','No'] ELSE ARRAY['Yes','No'] END;
   IF c->>k<>'' AND NOT(c->>k=ANY(choices)) THEN RAISE EXCEPTION 'Choose a valid report response'; END IF;
 END LOOP;
 choices:=ARRAY['Failure to adhere to policy','Failure to follow instruction','Operating without authority','Impairment/Unfit for Duty','Unsafe procedure or process','Uniform, Dress Code Violation','AWOL/No Call/No Show','AWOL/Call Off','Dereliction of Duty','Insubordination','Other, See Details'];
 IF jsonb_typeof(c->'factors') IS DISTINCT FROM 'array' OR jsonb_array_length(c->'factors')>11 THEN RAISE EXCEPTION 'Choose valid contributing factors'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(c->'factors') x WHERE jsonb_typeof(x)<>'string' OR NOT(x#>>'{}'=ANY(choices))) THEN RAISE EXCEPTION 'Choose valid contributing factors'; END IF;
 IF c->>'employeeId'<>'' THEN SELECT name INTO person_name FROM firehouse.employees WHERE id=c->>'employeeId'; IF NOT FOUND THEN RAISE EXCEPTION 'Choose an employee from the department roster'; END IF; END IF;
 IF c->>'supervisorId'<>'' THEN SELECT name INTO supervisor_name FROM firehouse.employees WHERE id=c->>'supervisorId'; IF NOT FOUND THEN RAISE EXCEPTION 'Choose a supervisor from the department roster'; END IF; END IF;
 c:=c||jsonb_build_object('employeeName',COALESCE(person_name,''),'supervisorName',COALESCE(supervisor_name,''));
 IF jsonb_typeof(c->'fileIds') IS DISTINCT FROM 'array' OR jsonb_array_length(c->'fileIds')>40 THEN RAISE EXCEPTION 'Choose no more than 40 report attachments'; END IF;
 FOR v IN SELECT jsonb_array_elements_text(c->'fileIds') LOOP
   IF NOT EXISTS(SELECT 1 FROM public.disciplinary_report_files f WHERE f.id::text=v AND f.report_id=NEW.id AND f.department_id=NEW.department_id) THEN RAISE EXCEPTION 'The attachment must belong to this report'; END IF;
 END LOOP;
 IF TG_OP='UPDATE' THEN
   IF NEW.id<>OLD.id OR NEW.department_id<>OLD.department_id OR NEW.version<>OLD.version+1 OR NEW.last_operation_id=OLD.last_operation_id THEN RAISE EXCEPTION 'Reload the latest report version before saving' USING ERRCODE='40001'; END IF;
   IF OLD.submitted_at IS NOT NULL AND length(btrim(NEW.change_reason))<5 THEN RAISE EXCEPTION 'Explain the correction to this submitted report'; END IF;
   NEW.created_at:=OLD.created_at;NEW.created_by:=OLD.created_by;NEW.created_by_name:=OLD.created_by_name;
 ELSE NEW.version:=1;NEW.created_at:=now();NEW.created_by:=auth.uid();NEW.created_by_name:=actor; END IF;
 IF length(NEW.change_reason)>2000 THEN RAISE EXCEPTION 'Keep the correction reason within 2000 characters'; END IF;
 signed:=COALESCE(c->'signatures','{}'::jsonb);
 IF jsonb_typeof(signed)<>'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(signed) key WHERE key NOT IN ('employee','witness','supervisor','chief')) THEN RAISE EXCEPTION 'Choose a valid signature section'; END IF;
 body_changed:=TG_OP='UPDATE' AND (c-'signatures') IS DISTINCT FROM (OLD.content-'signatures');
 FOR k,signature IN SELECT * FROM jsonb_each(signed) LOOP
   IF jsonb_typeof(signature)<>'object' OR jsonb_typeof(signature->'name') IS DISTINCT FROM 'string' OR length(btrim(signature->>'name')) NOT BETWEEN 1 AND 160 OR jsonb_typeof(signature->'image') IS DISTINCT FROM 'string' OR signature->>'image'!~'^data:image/png;base64,iVBORw0KGgo[A-Za-z0-9+/=]+$' OR length(signature->>'image')>160000 THEN RAISE EXCEPTION 'Enter an actual drawn signature and printed name, or leave it unsigned'; END IF;
   prior_signed:=CASE WHEN TG_OP='UPDATE' THEN OLD.content->'signatures'->k ELSE NULL END;
   IF prior_signed->>'image'=signature->>'image' AND prior_signed->>'name'=signature->>'name' THEN
     IF body_changed THEN signed:=signed-k; ELSE signed:=jsonb_set(signed,ARRAY[k],prior_signed); END IF;
   ELSE signed:=jsonb_set(signed,ARRAY[k],jsonb_build_object('name',btrim(signature->>'name'),'image',signature->>'image','recordedAt',now(),'recordedBy',actor)); END IF;
 END LOOP;
 NEW.content:=jsonb_set(c,'{signatures}',signed);NEW.updated_at:=now();NEW.updated_by:=auth.uid();NEW.updated_by_name:=actor;
 NEW.submitted_at:=CASE WHEN NEW.status='submitted' THEN now() WHEN TG_OP='UPDATE' THEN OLD.submitted_at ELSE NULL END;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.disciplinary_guard_report() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER disciplinary_guard_report BEFORE INSERT OR UPDATE ON public.disciplinary_reports FOR EACH ROW EXECUTE FUNCTION private.disciplinary_guard_report();
CREATE FUNCTION private.disciplinary_keep_version() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 INSERT INTO public.disciplinary_report_versions(report_id,department_id,version,content,status,change_reason,actor_id,actor_name,saved_at)
 VALUES(NEW.id,NEW.department_id,NEW.version,NEW.content,NEW.status,NEW.change_reason,NEW.updated_by,NEW.updated_by_name,NEW.updated_at);
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.disciplinary_keep_version() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER disciplinary_keep_version AFTER INSERT OR UPDATE ON public.disciplinary_reports FOR EACH ROW EXECUTE FUNCTION private.disciplinary_keep_version();

CREATE FUNCTION public.disciplinary_save(p_department uuid,p_id uuid,p_version integer,p_content jsonb,p_status text,p_reason text,p_operation uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE saved public.disciplinary_reports%ROWTYPE; fingerprint text;
BEGIN
 IF NOT public.disciplinary_access(p_department) THEN RAISE EXCEPTION 'Disciplinary access required' USING ERRCODE='42501'; END IF;
 IF p_id IS NULL OR p_operation IS NULL OR p_version IS NULL OR p_version<0 OR p_status NOT IN ('draft','submitted') OR p_status IS NULL THEN RAISE EXCEPTION 'Choose draft or submitted report and its saved version'; END IF;
 fingerprint:=md5(COALESCE(p_content::text,'')||p_status||COALESCE(p_reason,''));
 IF p_version=0 THEN
   INSERT INTO public.disciplinary_reports(id,department_id,content,status,version,change_reason,created_by,created_by_name,updated_by,updated_by_name,created_at,updated_at,last_operation_id,last_request_hash)
   VALUES(p_id,p_department,p_content,p_status,1,COALESCE(p_reason,''),auth.uid(),'',auth.uid(),'',now(),now(),p_operation,fingerprint) ON CONFLICT(id) DO NOTHING;
   SELECT * INTO saved FROM public.disciplinary_reports WHERE id=p_id AND department_id=p_department FOR UPDATE;
   IF saved.last_operation_id=p_operation AND saved.last_request_hash=fingerprint THEN RETURN to_jsonb(saved); END IF;
   RAISE EXCEPTION 'This report already exists. Refresh before saving again' USING ERRCODE='40001';
 END IF;
 SELECT * INTO saved FROM public.disciplinary_reports WHERE id=p_id AND department_id=p_department FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Report not found' USING ERRCODE='42501'; END IF;
 IF saved.last_operation_id=p_operation AND saved.last_request_hash=fingerprint THEN RETURN to_jsonb(saved); END IF;
 IF saved.version<>p_version THEN RAISE EXCEPTION 'Another editor saved this report. Your edits are retained; load the latest saved version before saving.' USING ERRCODE='40001'; END IF;
 UPDATE public.disciplinary_reports SET content=p_content,status=p_status,version=version+1,change_reason=COALESCE(p_reason,''),last_operation_id=p_operation,last_request_hash=fingerprint WHERE id=p_id AND department_id=p_department RETURNING * INTO saved;
 RETURN to_jsonb(saved);
END $$;
REVOKE ALL ON FUNCTION public.disciplinary_save(uuid,uuid,integer,jsonb,text,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.disciplinary_save(uuid,uuid,integer,jsonb,text,text,uuid) TO authenticated;

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types) VALUES('stickney-disciplinary-private','stickney-disciplinary-private',false,4194304,ARRAY['application/pdf','image/jpeg','image/png','image/webp','image/heic','image/heif','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/plain']) ON CONFLICT(id) DO NOTHING;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM storage.buckets WHERE id='stickney-disciplinary-private' AND public) THEN RAISE EXCEPTION 'Disciplinary files must be private'; END IF; END $$;
CREATE POLICY disciplinary_objects_read ON storage.objects FOR SELECT TO authenticated USING(bucket_id='stickney-disciplinary-private' AND EXISTS(SELECT 1 FROM public.disciplinary_report_files f WHERE f.object_key=name AND public.disciplinary_access(f.department_id)));
CREATE POLICY disciplinary_objects_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='stickney-disciplinary-private' AND EXISTS(SELECT 1 FROM public.disciplinary_reports r WHERE r.department_id::text=(storage.foldername(name))[1] AND r.id::text=(storage.foldername(name))[2] AND public.disciplinary_access(r.department_id)));
-- Restrictive guards keep unrelated legacy storage policies from broadening
-- access to this bucket, or permitting replacement/deletion of originals.
CREATE POLICY disciplinary_objects_read_guard ON storage.objects AS RESTRICTIVE FOR SELECT TO authenticated USING(bucket_id<>'stickney-disciplinary-private' OR EXISTS(SELECT 1 FROM public.disciplinary_report_files f WHERE f.object_key=name AND public.disciplinary_access(f.department_id)));
CREATE POLICY disciplinary_objects_insert_guard ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK(bucket_id<>'stickney-disciplinary-private' OR EXISTS(SELECT 1 FROM public.disciplinary_reports r WHERE r.department_id::text=(storage.foldername(name))[1] AND r.id::text=(storage.foldername(name))[2] AND public.disciplinary_access(r.department_id)));
-- Anonymous access must not query the private report tables, including while
-- evaluating policies on unrelated existing public buckets.
CREATE POLICY disciplinary_objects_anon_guard ON storage.objects AS RESTRICTIVE FOR ALL TO anon USING(bucket_id<>'stickney-disciplinary-private') WITH CHECK(bucket_id<>'stickney-disciplinary-private');
CREATE POLICY disciplinary_objects_no_replace ON storage.objects AS RESTRICTIVE FOR UPDATE TO PUBLIC USING(bucket_id<>'stickney-disciplinary-private') WITH CHECK(bucket_id<>'stickney-disciplinary-private');
CREATE POLICY disciplinary_objects_no_delete ON storage.objects AS RESTRICTIVE FOR DELETE TO PUBLIC USING(bucket_id<>'stickney-disciplinary-private');
