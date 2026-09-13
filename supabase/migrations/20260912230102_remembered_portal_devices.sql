-- Optional, absolute seven-day PIN leases. No existing member/credential rows change.
CREATE TABLE private.portal_remembered_devices (
  token_hash text PRIMARY KEY CHECK (length(token_hash) = 64),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES auth.sessions(id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  pin_fingerprint text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  UNIQUE (user_id, session_id),
  CHECK (expires_at > created_at AND expires_at <= created_at + interval '7 days')
);
ALTER TABLE private.portal_remembered_devices ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.portal_remembered_devices FROM PUBLIC, anon, authenticated;
CREATE INDEX portal_remembered_devices_session_idx ON private.portal_remembered_devices(session_id);
CREATE INDEX portal_remembered_devices_department_idx ON private.portal_remembered_devices(department_id);
CREATE INDEX portal_remembered_devices_user_created_idx ON private.portal_remembered_devices(user_id,created_at DESC);

CREATE FUNCTION private.portal_remembered_until(p_unlock_token text)
RETURNS timestamptz LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT d.expires_at
  FROM private.portal_remembered_devices d
  JOIN public.portal_pin_credentials c ON c.user_id = d.user_id
  JOIN auth.sessions s ON s.id = d.session_id AND s.user_id = d.user_id
  WHERE p_unlock_token LIKE 'rd1\_%' ESCAPE '\'
    AND d.token_hash = encode(extensions.digest(p_unlock_token,'sha256'),'hex')
    AND d.user_id = auth.uid()
    AND d.session_id::text = (auth.jwt()->>'session_id')
    AND d.expires_at > now()
    AND (s.not_after IS NULL OR s.not_after > now())
    AND d.pin_fingerprint = encode(extensions.digest(c.pin_hash,'sha256'),'hex')
    AND (c.locked_until IS NULL OR c.locked_until <= now())
    AND (EXISTS (SELECT 1 FROM public.department_memberships m
      WHERE m.user_id=d.user_id AND m.department_id=d.department_id AND m.status='active')
      OR public.is_platform_owner())
$$;
REVOKE ALL ON FUNCTION private.portal_remembered_until(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.portal_remembered_until(text) TO authenticated;

-- Fresh PIN verification and device issuance are one transaction. No caller-supplied
-- user/session ID, credential hash, duration, or expiry is accepted.
CREATE FUNCTION private.verify_portal_pin_with_device(p_pin text,p_department_id uuid)
RETURNS TABLE(ok boolean,unlock_token text,locked_until timestamptz,remembered_until timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  current_user_id uuid := auth.uid();
  current_session_id uuid;
  verified record;
  next_token text;
  deadline timestamptz := now() + interval '7 days';
BEGIN
  SELECT s.id INTO current_session_id FROM auth.sessions s
    WHERE s.id=NULLIF(auth.jwt()->>'session_id','')::uuid AND s.user_id=current_user_id
      AND (s.not_after IS NULL OR s.not_after>now());
  IF current_user_id IS NULL OR current_session_id IS NULL OR p_department_id IS NULL
    OR NOT (EXISTS (SELECT 1 FROM public.department_memberships m
      WHERE m.user_id=current_user_id AND m.department_id=p_department_id AND m.status='active')
      OR public.is_platform_owner()) THEN
    RAISE EXCEPTION 'Current department sign-in is required.' USING ERRCODE='42501';
  END IF;
  SELECT * INTO verified FROM public.verify_portal_pin(p_pin);
  IF verified.ok IS DISTINCT FROM true THEN
    RETURN QUERY SELECT false,NULL::text,verified.locked_until,NULL::timestamptz;
    RETURN;
  END IF;
  -- verify_portal_pin holds the credential row lock, serializing own-device issuance.
  DELETE FROM private.portal_remembered_devices d WHERE d.user_id=current_user_id
    AND (d.expires_at<=now() OR d.session_id=current_session_id);
  DELETE FROM private.portal_remembered_devices d WHERE d.token_hash IN (
    SELECT old.token_hash FROM private.portal_remembered_devices old
    WHERE old.user_id=current_user_id ORDER BY old.created_at DESC,old.token_hash OFFSET 19
  );
  next_token := 'rd1_' || encode(extensions.gen_random_bytes(32),'hex');
  INSERT INTO private.portal_remembered_devices(token_hash,user_id,session_id,department_id,pin_fingerprint,expires_at)
    SELECT encode(extensions.digest(next_token,'sha256'),'hex'),current_user_id,current_session_id,p_department_id,
      encode(extensions.digest(c.pin_hash,'sha256'),'hex'),deadline
    FROM public.portal_pin_credentials c WHERE c.user_id=current_user_id;
  RETURN QUERY SELECT true,next_token,NULL::timestamptz,deadline;
END;
$$;
REVOKE ALL ON FUNCTION private.verify_portal_pin_with_device(text,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.verify_portal_pin_with_device(text,uuid) TO authenticated;
CREATE FUNCTION public.verify_portal_pin_with_device(p_pin text,p_department_id uuid)
RETURNS TABLE(ok boolean,unlock_token text,locked_until timestamptz,remembered_until timestamptz)
LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT * FROM private.verify_portal_pin_with_device(p_pin,p_department_id)
$$;
REVOKE ALL ON FUNCTION public.verify_portal_pin_with_device(text,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.verify_portal_pin_with_device(text,uuid) TO authenticated;

CREATE FUNCTION public.portal_remembered_device_status(p_unlock_token text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT jsonb_build_object('rememberedUntil',private.portal_remembered_until(p_unlock_token),'serverNow',now())
$$;
REVOKE ALL ON FUNCTION public.portal_remembered_device_status(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.portal_remembered_device_status(text) TO authenticated;

CREATE FUNCTION private.forget_own_portal_device(p_unlock_token text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  DELETE FROM private.portal_remembered_devices d WHERE d.user_id=auth.uid()
    AND d.session_id::text=(auth.jwt()->>'session_id')
    AND d.token_hash=encode(extensions.digest(p_unlock_token,'sha256'),'hex')
$$;
REVOKE ALL ON FUNCTION private.forget_own_portal_device(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.forget_own_portal_device(text) TO authenticated;
CREATE FUNCTION public.forget_own_portal_device(p_unlock_token text)
RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT private.forget_own_portal_device(p_unlock_token)
$$;
REVOKE ALL ON FUNCTION public.forget_own_portal_device(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.forget_own_portal_device(text) TO authenticated;

-- Keep the existing contracts used by proxy, Inventory, and direct database checks.
CREATE OR REPLACE FUNCTION public.portal_pin_status(p_unlock_token text DEFAULT NULL)
RETURNS TABLE(configured boolean,unlocked boolean,locked_until timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT c.user_id IS NOT NULL,
    c.user_id IS NOT NULL AND (
      COALESCE(c.unlock_token_hash=encode(extensions.digest(p_unlock_token,'sha256'),'hex') AND c.unlock_expires_at>now(),false)
      OR private.portal_remembered_until(p_unlock_token) IS NOT NULL),c.locked_until
  FROM (SELECT auth.uid() AS user_id) identity_row
  LEFT JOIN public.portal_pin_credentials c ON c.user_id=identity_row.user_id
$$;
CREATE OR REPLACE FUNCTION public.verify_portal_unlock(p_unlock_token text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT COALESCE((SELECT s.unlocked FROM public.portal_pin_status(p_unlock_token) s),false)
$$;
REVOKE ALL ON FUNCTION public.portal_pin_status(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.verify_portal_unlock(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.portal_pin_status(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_portal_unlock(text) TO authenticated;

-- Legacy 30-minute browser / existing TV leases and their renewal RPCs stay unchanged.
-- Remembered tokens never match the legacy credential hash, so neither renewal RPC
-- can extend or convert a remembered device into an unlimited station-display lease.
