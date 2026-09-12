SET LOCAL lock_timeout='3s';
CREATE TABLE firehouse.portal_confirmation_messages (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text NOT NULL, message text NOT NULL,
 enabled boolean NOT NULL DEFAULT false, created_by text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(length(title) BETWEEN 1 AND 120), CHECK(length(message)<=4000), CHECK(NOT enabled OR length(btrim(message))>0)
);
CREATE TABLE firehouse.portal_confirmation_setting (
 department_id uuid PRIMARY KEY CHECK(department_id='14a76771-4c24-481b-8def-e6cce005c17b'),
 message_id uuid REFERENCES firehouse.portal_confirmation_messages(id)
);
INSERT INTO firehouse.portal_confirmation_setting VALUES('14a76771-4c24-481b-8def-e6cce005c17b',NULL);
CREATE TABLE firehouse.portal_confirmation_receipts (
 message_id uuid NOT NULL REFERENCES firehouse.portal_confirmation_messages(id),
 user_id uuid NOT NULL, confirmed_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(message_id,user_id)
);
ALTER TABLE firehouse.portal_confirmation_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE firehouse.portal_confirmation_setting ENABLE ROW LEVEL SECURITY;
ALTER TABLE firehouse.portal_confirmation_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON firehouse.portal_confirmation_messages,firehouse.portal_confirmation_setting,firehouse.portal_confirmation_receipts FROM PUBLIC,anon,authenticated,service_role;

-- Read-only, own-identity status for the verified proxy. No message contents,
-- receipts for other users, credentials or mutation capability are exposed.
CREATE FUNCTION private.portal_confirmation_status() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=auth.uid(); actor_email text; current_message record; exempt boolean:=false;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'Sign in required' USING ERRCODE='42501'; END IF;
 SELECT lower(btrim(u.email)) INTO actor_email FROM auth.users u WHERE u.id=actor AND u.deleted_at IS NULL AND (u.banned_until IS NULL OR u.banned_until<=now());
 IF actor_email IS NULL THEN RAISE EXCEPTION 'Current account required' USING ERRCODE='42501'; END IF;
 exempt=actor_email='bobff353@gmail.com' AND EXISTS(SELECT 1 FROM public.platform_owners p WHERE lower(btrim(p.email))=actor_email);
 IF NOT exempt AND NOT EXISTS(SELECT 1 FROM public.department_memberships m WHERE m.department_id='14a76771-4c24-481b-8def-e6cce005c17b' AND m.user_id=actor AND m.status='active') THEN RAISE EXCEPTION 'Department access required' USING ERRCODE='42501'; END IF;
 SELECT m.id,m.enabled INTO current_message FROM firehouse.portal_confirmation_setting s LEFT JOIN firehouse.portal_confirmation_messages m ON m.id=s.message_id WHERE s.department_id='14a76771-4c24-481b-8def-e6cce005c17b';
 IF coalesce(current_message.enabled,false) THEN
  exempt=exempt OR (SELECT count(*)=1 AND coalesce(bool_and(ep.is_admin=1),false) FROM firehouse.employees e JOIN firehouse.employee_profiles ep ON ep.employee_id=e.id WHERE e.active=1 AND lower(btrim(ep.email))=actor_email AND (coalesce(ep.end_date,'')='' OR ep.end_date>=to_char(now() AT TIME ZONE 'America/Chicago','YYYY-MM-DD')));
 END IF;
 RETURN jsonb_build_object('version',current_message.id,'required',coalesce(current_message.enabled,false) AND NOT exempt AND NOT EXISTS(SELECT 1 FROM firehouse.portal_confirmation_receipts r WHERE r.message_id=current_message.id AND r.user_id=actor),'exempt',exempt);
END $$;
REVOKE ALL ON FUNCTION private.portal_confirmation_status() FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION private.portal_confirmation_status() TO authenticated;
CREATE FUNCTION public.portal_confirmation_status() RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$ SELECT private.portal_confirmation_status(); $$;
REVOKE ALL ON FUNCTION public.portal_confirmation_status() FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.portal_confirmation_status() TO authenticated;

CREATE FUNCTION firehouse.save_portal_confirmation(encoded text) RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE body jsonb:=convert_from(decode(encoded,'base64'),'UTF8')::jsonb; previous record; saved_id uuid;
BEGIN
 SELECT message_id INTO saved_id FROM firehouse.portal_confirmation_setting WHERE department_id='14a76771-4c24-481b-8def-e6cce005c17b' FOR UPDATE;
 IF coalesce(saved_id::text,'')<>coalesce(body->>'version','') THEN RAISE EXCEPTION 'CONFIRMATION_CONFLICT'; END IF;
 SELECT * INTO previous FROM firehouse.portal_confirmation_messages WHERE id=saved_id;
 IF FOUND AND previous.title=body->>'title' AND previous.message=body->>'message' AND previous.enabled=(body->>'enabled')::boolean THEN RETURN saved_id; END IF;
 INSERT INTO firehouse.portal_confirmation_messages(title,message,enabled,created_by) VALUES(body->>'title',body->>'message',(body->>'enabled')::boolean,body->>'actor') RETURNING id INTO saved_id;
 UPDATE firehouse.portal_confirmation_setting SET message_id=saved_id WHERE department_id='14a76771-4c24-481b-8def-e6cce005c17b';
 RETURN saved_id;
END $$;
CREATE FUNCTION firehouse.confirm_portal_message(expected uuid,recipient uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE saved_id uuid; active boolean;
BEGIN
 IF recipient IS NULL OR recipient IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Confirm your own message' USING ERRCODE='42501'; END IF;
 PERFORM private.portal_confirmation_status();
 SELECT message_id INTO saved_id FROM firehouse.portal_confirmation_setting WHERE department_id='14a76771-4c24-481b-8def-e6cce005c17b' FOR SHARE;
 SELECT enabled INTO active FROM firehouse.portal_confirmation_messages WHERE id=saved_id;
 IF saved_id IS DISTINCT FROM expected OR NOT coalesce(active,false) THEN RAISE EXCEPTION 'CONFIRMATION_CONFLICT'; END IF;
 INSERT INTO firehouse.portal_confirmation_receipts(message_id,user_id) VALUES(expected,recipient) ON CONFLICT DO NOTHING;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION firehouse.save_portal_confirmation(text),firehouse.confirm_portal_message(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
