-- Historical source provenance is immutable. Native corrections retain versions.
ALTER TABLE public.disciplinary_reports ADD COLUMN source_record jsonb,ADD COLUMN source_id text,ADD COLUMN source_status text CHECK(source_status IN ('draft','submitted')),ADD COLUMN source_at timestamptz;
CREATE UNIQUE INDEX disciplinary_report_source_unique ON public.disciplinary_reports(department_id,source_id) WHERE source_id IS NOT NULL;
CREATE INDEX disciplinary_report_source_history ON public.disciplinary_reports(department_id,source_at DESC NULLS FIRST,updated_at DESC,id DESC);
CREATE FUNCTION public.disciplinary_import_access(p_department uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$ SELECT public.disciplinary_access(p_department) AND (SELECT private.portal_has_permission('permissions.manage')) $$;
REVOKE ALL ON FUNCTION public.disciplinary_import_access(uuid) FROM PUBLIC,anon;GRANT EXECUTE ON FUNCTION public.disciplinary_import_access(uuid) TO authenticated;
CREATE TABLE public.disciplinary_import_staging(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),department_id uuid NOT NULL REFERENCES public.departments(id),source_id text NOT NULL,source_hash text NOT NULL CHECK(source_hash~'^[a-f0-9]{64}$'),source_record jsonb NOT NULL,content jsonb NOT NULL,
 file_id uuid NOT NULL DEFAULT gen_random_uuid(),object_key text NOT NULL,pdf_filename text NOT NULL,pdf_sha256 text NOT NULL,pdf_size bigint NOT NULL CHECK(pdf_size BETWEEN 5 AND 4194304),created_by uuid NOT NULL DEFAULT auth.uid(),created_at timestamptz NOT NULL DEFAULT now(),completed_at timestamptz,UNIQUE(department_id,source_id)
);
ALTER TABLE public.disciplinary_import_staging ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.disciplinary_import_staging FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.disciplinary_import_staging TO authenticated;
CREATE POLICY disciplinary_staging_access ON public.disciplinary_import_staging TO authenticated USING(created_by=(SELECT auth.uid()) AND public.disciplinary_import_access(department_id)) WITH CHECK(created_by=(SELECT auth.uid()) AND public.disciplinary_import_access(department_id));
CREATE FUNCTION public.disciplinary_import_prepare(p_department uuid,p_source jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE r public.disciplinary_reports%ROWTYPE;s public.disciplinary_import_staging%ROWTYPE;new_id uuid:=gen_random_uuid();new_file uuid:=gen_random_uuid();
BEGIN
 IF NOT public.disciplinary_import_access(p_department) THEN RAISE EXCEPTION 'Disciplinary import administrator access required' USING ERRCODE='42501'; END IF;
 IF COALESCE(p_source->>'system','')<>'aladtec' OR COALESCE(p_source->>'formId','')<>'149' OR COALESCE(p_source->>'id','')!~'^[0-9]+$' OR COALESCE(p_source->>'importHash','')!~'^[a-f0-9]{64}$' OR COALESCE(p_source->>'status','') NOT IN ('draft','submitted') OR jsonb_typeof(p_source->'originalContent') IS DISTINCT FROM 'object' OR COALESCE(p_source->'capture'->>'sha256','')!~'^[a-f0-9]{64}$' OR octet_length(p_source::text)>1500000 THEN RAISE EXCEPTION 'Invalid captured source record'; END IF;
 SELECT * INTO r FROM public.disciplinary_reports WHERE department_id=p_department AND source_id=p_source->>'id';
 IF FOUND THEN IF r.source_record->>'importHash'<>p_source->>'importHash' THEN RAISE EXCEPTION 'This Aladtec report already exists with different source facts. Review the conflict; it was not overwritten' USING ERRCODE='40001'; END IF;RETURN jsonb_build_object('complete',true,'reportId',r.id,'alreadyImported',true);END IF;
 INSERT INTO public.disciplinary_import_staging(id,department_id,source_id,source_hash,source_record,content,file_id,object_key,pdf_filename,pdf_sha256,pdf_size)
 VALUES(new_id,p_department,p_source->>'id',p_source->>'importHash',p_source||jsonb_build_object('documentFileId',new_file),(p_source->'originalContent'),new_file,p_department::text||'/'||new_id::text||'/'||new_file::text||'.pdf',p_source->'capture'->>'filename',p_source->'capture'->>'sha256',(p_source->'capture'->>'byteSize')::bigint) ON CONFLICT(department_id,source_id) DO NOTHING;
 SELECT * INTO s FROM public.disciplinary_import_staging WHERE department_id=p_department AND source_id=p_source->>'id';
 IF NOT FOUND OR s.source_hash<>p_source->>'importHash' OR s.pdf_sha256<>p_source->'capture'->>'sha256' THEN RAISE EXCEPTION 'A different import is already staged. No report was changed' USING ERRCODE='40001';END IF;
 RETURN jsonb_build_object('complete',false,'stageId',s.id,'reportId',s.id,'fileId',s.file_id,'sourceId',s.source_id);
END $$;
REVOKE ALL ON FUNCTION public.disciplinary_import_prepare(uuid,jsonb) FROM PUBLIC,anon;GRANT EXECUTE ON FUNCTION public.disciplinary_import_prepare(uuid,jsonb) TO authenticated;
CREATE FUNCTION public.disciplinary_import_finish(p_department uuid,p_stage uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE s public.disciplinary_import_staging%ROWTYPE;r public.disciplinary_reports%ROWTYPE;
BEGIN
 IF NOT public.disciplinary_import_access(p_department) THEN RAISE EXCEPTION 'Disciplinary import administrator access required' USING ERRCODE='42501';END IF;
 SELECT * INTO s FROM public.disciplinary_import_staging WHERE id=p_stage AND department_id=p_department FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'Import stage unavailable' USING ERRCODE='42501';END IF;
 SELECT * INTO r FROM public.disciplinary_reports WHERE department_id=p_department AND source_id=s.source_id;
 IF FOUND THEN IF r.source_record->>'importHash'<>s.source_hash THEN RAISE EXCEPTION 'Source conflict; existing report retained' USING ERRCODE='40001';END IF;RETURN jsonb_build_object('reportId',r.id,'alreadyImported',true);END IF;
 IF NOT EXISTS(SELECT 1 FROM storage.objects o WHERE o.bucket_id='stickney-disciplinary-private' AND o.name=s.object_key AND (o.metadata->>'size')::bigint=s.pdf_size) THEN RAISE EXCEPTION 'The original source page capture must be uploaded before import';END IF;
 INSERT INTO public.disciplinary_reports(id,department_id,content,status,version,change_reason,created_by,created_by_name,updated_by,updated_by_name,created_at,updated_at,last_operation_id,last_request_hash,source_record)
 VALUES(s.id,p_department,s.content,s.source_record->>'status',1,'Copied from original Aladtec record '||s.source_id,auth.uid(),'',auth.uid(),'',now(),now(),gen_random_uuid(),s.source_hash,s.source_record) RETURNING * INTO r;
 INSERT INTO public.disciplinary_report_files(id,department_id,report_id,object_key,original_filename,mime_type,byte_size,sha256,uploaded_by,uploaded_by_name)
 VALUES(s.file_id,p_department,r.id,s.object_key,s.pdf_filename,'application/pdf',s.pdf_size,s.pdf_sha256,auth.uid(),r.updated_by_name);
 UPDATE public.disciplinary_import_staging SET completed_at=now() WHERE id=s.id;
 RETURN jsonb_build_object('reportId',r.id,'version',r.version,'alreadyImported',false);
END $$;
REVOKE ALL ON FUNCTION public.disciplinary_import_finish(uuid,uuid) FROM PUBLIC,anon;GRANT EXECUTE ON FUNCTION public.disciplinary_import_finish(uuid,uuid) TO authenticated;
CREATE POLICY disciplinary_staging_objects_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='stickney-disciplinary-private' AND EXISTS(SELECT 1 FROM public.disciplinary_import_staging s WHERE s.object_key=name AND s.created_by=auth.uid() AND public.disciplinary_import_access(s.department_id)));
CREATE POLICY disciplinary_staging_objects_read ON storage.objects FOR SELECT TO authenticated USING(bucket_id='stickney-disciplinary-private' AND EXISTS(SELECT 1 FROM public.disciplinary_import_staging s WHERE s.object_key=name AND s.created_by=auth.uid() AND public.disciplinary_import_access(s.department_id)));
ALTER POLICY disciplinary_objects_read_guard ON storage.objects USING(bucket_id<>'stickney-disciplinary-private' OR EXISTS(SELECT 1 FROM public.disciplinary_report_files f WHERE f.object_key=name AND public.disciplinary_access(f.department_id)) OR EXISTS(SELECT 1 FROM public.disciplinary_import_staging s WHERE s.object_key=name AND s.created_by=auth.uid() AND public.disciplinary_import_access(s.department_id)));
ALTER POLICY disciplinary_objects_insert_guard ON storage.objects WITH CHECK(bucket_id<>'stickney-disciplinary-private' OR EXISTS(SELECT 1 FROM public.disciplinary_reports r WHERE r.department_id::text=(storage.foldername(name))[1] AND r.id::text=(storage.foldername(name))[2] AND public.disciplinary_access(r.department_id)) OR EXISTS(SELECT 1 FROM public.disciplinary_import_staging s WHERE s.object_key=name AND s.created_by=auth.uid() AND public.disciplinary_import_access(s.department_id)));

CREATE OR REPLACE FUNCTION private.disciplinary_guard_report() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c jsonb; k text; v text; choices text[]; actor text; actor_email text; person_name text; supervisor_name text; signed jsonb; prior_signed jsonb; signature jsonb; d date; body_changed boolean; src jsonb; original jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT public.disciplinary_access(NEW.department_id) THEN RAISE EXCEPTION 'Disciplinary access required' USING ERRCODE='42501'; END IF;
 SELECT lower(email) INTO actor_email FROM auth.users WHERE id=auth.uid();
 SELECT name INTO actor FROM firehouse.employees WHERE id=firehouse.employee_id_for_login(actor_email);
 actor:=COALESCE(actor,actor_email);
 src:=NEW.source_record;
 IF TG_OP='UPDATE' AND src IS DISTINCT FROM OLD.source_record THEN RAISE EXCEPTION 'Original Aladtec provenance cannot be changed'; END IF;
 IF src IS NOT NULL THEN
   IF COALESCE(src->>'system','')<>'aladtec' OR COALESCE(src->>'formId','')<>'149' OR COALESCE(src->>'id','')!~'^[0-9]+$' OR COALESCE(src->>'status','') NOT IN ('draft','submitted') OR COALESCE(src->>'localTimestamp','')!~'^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00$' OR COALESCE(src->>'timeZone','')<>'America/Chicago' OR jsonb_typeof(src->'originalContent') IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Invalid original Aladtec record'; END IF;
   IF TG_OP='INSERT' AND (NOT public.disciplinary_import_access(NEW.department_id) OR NOT EXISTS(SELECT 1 FROM public.disciplinary_import_staging s WHERE s.id=NEW.id AND s.department_id=NEW.department_id AND s.created_by=auth.uid() AND s.source_record=src AND s.content=NEW.content)) THEN RAISE EXCEPTION 'Use the verified disciplinary import' USING ERRCODE='42501'; END IF;
   NEW.source_id:=src->>'id';NEW.source_status:=src->>'status';NEW.source_at:=(src->>'localTimestamp')::timestamp AT TIME ZONE 'America/Chicago';
   IF NEW.source_at>now() THEN RAISE EXCEPTION 'The original source timestamp cannot be in the future'; END IF;
   original:=src->'originalContent';
   IF TG_OP='INSERT' THEN src:=src||jsonb_build_object('importedAt',now());NEW.source_record:=src; END IF;
 ELSE NEW.source_id:=NULL;NEW.source_status:=NULL;NEW.source_at:=NULL; END IF;
 c:=NEW.content;
 IF c IS NULL OR jsonb_typeof(c)<>'object' OR octet_length(c::text)>900000 OR c->'schemaVersion' IS DISTINCT FROM '1'::jsonb THEN RAISE EXCEPTION 'Enter a valid disciplinary report'; END IF;
 FOR k IN SELECT jsonb_object_keys(c) LOOP
   IF k NOT IN ('schemaVersion','employeeId','employeeName','supervisorId','supervisorName','incidentDate','incidentTime','incidentNumber','disciplineStep','previousDiscipline','factors','details','correctiveActions','documentationProvided','employeeResponse','employeeComments','fileIds','signatures') THEN RAISE EXCEPTION 'Unknown report field'; END IF;
 END LOOP;
 FOREACH k IN ARRAY ARRAY['employeeId','supervisorId','incidentDate','incidentTime','incidentNumber','disciplineStep','previousDiscipline','details','correctiveActions','documentationProvided','employeeResponse','employeeComments'] LOOP
   IF jsonb_typeof(c->k) IS DISTINCT FROM 'string' OR length(c->>k)>(CASE WHEN k IN ('details','correctiveActions','employeeComments') THEN 12000 ELSE 160 END) THEN RAISE EXCEPTION 'Enter report text within its displayed limit'; END IF;
   IF NEW.status='submitted' AND k IN ('employeeId','supervisorId','incidentDate','disciplineStep','previousDiscipline','details','documentationProvided','employeeResponse') AND NULLIF(btrim(c->>k),'') IS NULL AND NOT ((k='employeeId' AND c->>'employeeId'=original->>'employeeId' AND NULLIF(original->>'employeeName','') IS NOT NULL) OR (k='supervisorId' AND c->>'supervisorId'=original->>'supervisorId' AND NULLIF(original->>'supervisorName','') IS NOT NULL)) THEN RAISE EXCEPTION 'Complete every required report field before submitting'; END IF;
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
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(c->'factors') x WHERE jsonb_typeof(x)<>'string' OR (NOT(x#>>'{}'=ANY(choices)) AND NOT(COALESCE(original->'factors','[]'::jsonb) @> jsonb_build_array(x)))) THEN RAISE EXCEPTION 'Choose valid contributing factors'; END IF;
 IF original IS NOT NULL AND c->>'employeeId'=original->>'employeeId' THEN person_name:=original->>'employeeName'; ELSIF c->>'employeeId'<>'' THEN SELECT name INTO person_name FROM firehouse.employees WHERE id=c->>'employeeId'; IF NOT FOUND THEN RAISE EXCEPTION 'Choose an employee from the department roster'; END IF; END IF;
 IF original IS NOT NULL AND c->>'supervisorId'=original->>'supervisorId' THEN supervisor_name:=original->>'supervisorName'; ELSIF c->>'supervisorId'<>'' THEN SELECT name INTO supervisor_name FROM firehouse.employees WHERE id=c->>'supervisorId'; IF NOT FOUND THEN RAISE EXCEPTION 'Choose a supervisor from the department roster'; END IF; END IF;
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
   IF jsonb_typeof(signature)<>'object' OR jsonb_typeof(signature->'name') IS DISTINCT FROM 'string' OR (length(btrim(signature->>'name')) NOT BETWEEN 1 AND 160 AND NOT(COALESCE(signature->>'origin'='aladtec' AND signature->>'name'='' AND original->'signatures'->k->>'image'=signature->>'image',false))) OR jsonb_typeof(signature->'image') IS DISTINCT FROM 'string' OR signature->>'image'!~'^data:image/png;base64,iVBORw0KGgo[A-Za-z0-9+/=]+$' OR length(signature->>'image')>160000 THEN RAISE EXCEPTION 'Enter an actual drawn signature and printed name, or leave it unsigned'; END IF;
   IF signature->>'origin'='aladtec' THEN
     IF original IS NULL OR signature->>'name'<>'' OR (original->'signatures'->k->>'image') IS DISTINCT FROM (signature->>'image') THEN RAISE EXCEPTION 'An original signature must match the captured Aladtec evidence'; END IF;
     IF body_changed THEN signed:=signed-k; ELSE signed:=jsonb_set(signed,ARRAY[k],original->'signatures'->k); END IF;
     CONTINUE;
   END IF;
   prior_signed:=CASE WHEN TG_OP='UPDATE' THEN OLD.content->'signatures'->k ELSE NULL END;
   IF prior_signed->>'image'=signature->>'image' AND prior_signed->>'name'=signature->>'name' THEN
     IF body_changed THEN signed:=signed-k; ELSE signed:=jsonb_set(signed,ARRAY[k],prior_signed); END IF;
   ELSE signed:=jsonb_set(signed,ARRAY[k],jsonb_build_object('name',btrim(signature->>'name'),'image',signature->>'image','recordedAt',now(),'recordedBy',actor)); END IF;
 END LOOP;
 NEW.content:=jsonb_set(c,'{signatures}',signed);NEW.updated_at:=now();NEW.updated_by:=auth.uid();NEW.updated_by_name:=actor;
 NEW.submitted_at:=CASE WHEN TG_OP='INSERT' AND NEW.source_status='submitted' THEN NEW.source_at WHEN NEW.status='submitted' THEN now() WHEN TG_OP='UPDATE' THEN OLD.submitted_at ELSE NULL END;
 RETURN NEW;
END $$;
