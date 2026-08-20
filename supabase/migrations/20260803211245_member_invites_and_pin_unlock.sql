CREATE TABLE IF NOT EXISTS public.portal_pin_credentials (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  pin_hash text NOT NULL,
  failed_attempts integer NOT NULL DEFAULT 0 CHECK (failed_attempts >= 0),
  locked_until timestamptz,
  unlock_token_hash text,
  unlock_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.portal_pin_credentials ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.portal_pin_credentials FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.portal_pin_status(p_unlock_token text DEFAULT NULL)
RETURNS TABLE(configured boolean, unlocked boolean, locked_until timestamptz)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
STABLE
AS $$
  SELECT
    credentials.user_id IS NOT NULL,
    credentials.user_id IS NOT NULL
      AND p_unlock_token IS NOT NULL
      AND credentials.unlock_token_hash = encode(digest(p_unlock_token, 'sha256'), 'hex')
      AND credentials.unlock_expires_at > now(),
    credentials.locked_until
  FROM (SELECT auth.uid() AS user_id) session_user_row
  LEFT JOIN public.portal_pin_credentials credentials
    ON credentials.user_id = session_user_row.user_id;
$$;

CREATE OR REPLACE FUNCTION public.set_portal_pin(p_pin text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  unlock_token text;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Verified sign-in is required.' USING ERRCODE = '42501';
  END IF;
  IF p_pin !~ '^\d{4,6}$' THEN
    RAISE EXCEPTION 'PIN must contain 4 to 6 digits.' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.department_memberships membership
    WHERE membership.user_id = current_user_id AND membership.status = 'active'
  ) AND NOT public.is_platform_owner() THEN
    RAISE EXCEPTION 'Active department membership is required.' USING ERRCODE = '42501';
  END IF;

  unlock_token := encode(gen_random_bytes(32), 'hex');
  INSERT INTO public.portal_pin_credentials (
    user_id, pin_hash, failed_attempts, locked_until,
    unlock_token_hash, unlock_expires_at, updated_at
  ) VALUES (
    current_user_id, crypt(p_pin, gen_salt('bf', 12)), 0, NULL,
    encode(digest(unlock_token, 'sha256'), 'hex'), now() + interval '12 hours', now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    pin_hash = excluded.pin_hash,
    failed_attempts = 0,
    locked_until = NULL,
    unlock_token_hash = excluded.unlock_token_hash,
    unlock_expires_at = excluded.unlock_expires_at,
    updated_at = now();

  RETURN unlock_token;
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_portal_pin(p_pin text)
RETURNS TABLE(ok boolean, unlock_token text, locked_until timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  credentials public.portal_pin_credentials%ROWTYPE;
  next_failed_attempts integer;
  next_unlock_token text;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Verified sign-in is required.' USING ERRCODE = '42501';
  END IF;
  IF p_pin !~ '^\d{4,6}$' THEN
    RETURN QUERY SELECT false, NULL::text, NULL::timestamptz;
    RETURN;
  END IF;

  SELECT * INTO credentials
  FROM public.portal_pin_credentials
  WHERE user_id = current_user_id
  FOR UPDATE;

  IF credentials.user_id IS NULL THEN
    RAISE EXCEPTION 'A portal PIN has not been configured.' USING ERRCODE = 'P0002';
  END IF;
  IF credentials.locked_until IS NOT NULL AND credentials.locked_until > now() THEN
    RETURN QUERY SELECT false, NULL::text, credentials.locked_until;
    RETURN;
  END IF;

  IF crypt(p_pin, credentials.pin_hash) = credentials.pin_hash THEN
    next_unlock_token := encode(gen_random_bytes(32), 'hex');
    UPDATE public.portal_pin_credentials SET
      failed_attempts = 0,
      locked_until = NULL,
      unlock_token_hash = encode(digest(next_unlock_token, 'sha256'), 'hex'),
      unlock_expires_at = now() + interval '12 hours',
      updated_at = now()
    WHERE user_id = current_user_id;
    RETURN QUERY SELECT true, next_unlock_token, NULL::timestamptz;
    RETURN;
  END IF;

  next_failed_attempts := credentials.failed_attempts + 1;
  UPDATE public.portal_pin_credentials SET
    failed_attempts = CASE WHEN next_failed_attempts >= 5 THEN 0 ELSE next_failed_attempts END,
    locked_until = CASE WHEN next_failed_attempts >= 5 THEN now() + interval '15 minutes' ELSE NULL END,
    unlock_token_hash = NULL,
    unlock_expires_at = NULL,
    updated_at = now()
  WHERE user_id = current_user_id
  RETURNING portal_pin_credentials.locked_until INTO credentials.locked_until;

  RETURN QUERY SELECT false, NULL::text, credentials.locked_until;
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_portal_unlock(p_unlock_token text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.portal_pin_credentials credentials
    WHERE credentials.user_id = auth.uid()
      AND p_unlock_token IS NOT NULL
      AND credentials.unlock_token_hash = encode(digest(p_unlock_token, 'sha256'), 'hex')
      AND credentials.unlock_expires_at > now()
  );
$$;

REVOKE ALL ON FUNCTION public.portal_pin_status(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_portal_pin(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.verify_portal_pin(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.verify_portal_unlock(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.portal_pin_status(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_portal_pin(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_portal_pin(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_portal_unlock(text) TO authenticated;
