CREATE OR REPLACE FUNCTION firehouse.verify_portal_login(
  p_email text,
  p_pin text,
  p_department_id uuid
)
RETURNS TABLE(ok boolean, email text, locked_until timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  normalized_email text := lower(trim(coalesce(p_email, '')));
  target_user_id uuid;
  verified_email text;
  credentials public.portal_pin_credentials%ROWTYPE;
  next_failed_attempts integer;
BEGIN
  IF normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
     OR coalesce(p_pin, '') !~ '^\d{4,6}$'
     OR p_department_id IS NULL THEN
    RETURN QUERY SELECT false, NULL::text, NULL::timestamptz;
    RETURN;
  END IF;

  SELECT auth_user.id, lower(auth_user.email)
  INTO target_user_id, verified_email
  FROM auth.users AS auth_user
  JOIN public.portal_pin_credentials AS pin_credentials
    ON pin_credentials.user_id = auth_user.id
  WHERE lower(auth_user.email) = normalized_email
    AND (
      EXISTS (
        SELECT 1
        FROM public.department_memberships AS membership
        WHERE membership.user_id = auth_user.id
          AND membership.department_id = p_department_id
          AND membership.status = 'active'
      )
      OR EXISTS (
        SELECT 1
        FROM public.platform_owners AS owner_record
        WHERE lower(owner_record.email) = normalized_email
      )
    )
  LIMIT 1;

  IF target_user_id IS NULL THEN
    RETURN QUERY SELECT false, NULL::text, NULL::timestamptz;
    RETURN;
  END IF;

  SELECT * INTO credentials
  FROM public.portal_pin_credentials AS pin_credentials
  WHERE pin_credentials.user_id = target_user_id
  FOR UPDATE;

  IF credentials.locked_until IS NOT NULL AND credentials.locked_until > now() THEN
    RETURN QUERY SELECT false, NULL::text, credentials.locked_until;
    RETURN;
  END IF;

  IF extensions.crypt(p_pin, credentials.pin_hash) = credentials.pin_hash THEN
    UPDATE public.portal_pin_credentials SET
      failed_attempts = 0,
      locked_until = NULL,
      updated_at = now()
    WHERE user_id = target_user_id;
    RETURN QUERY SELECT true, verified_email, NULL::timestamptz;
    RETURN;
  END IF;

  next_failed_attempts := credentials.failed_attempts + 1;
  UPDATE public.portal_pin_credentials SET
    failed_attempts = CASE WHEN next_failed_attempts >= 5 THEN 0 ELSE next_failed_attempts END,
    locked_until = CASE WHEN next_failed_attempts >= 5 THEN now() + interval '15 minutes' ELSE NULL END,
    unlock_token_hash = NULL,
    unlock_expires_at = NULL,
    updated_at = now()
  WHERE user_id = target_user_id
  RETURNING portal_pin_credentials.locked_until INTO credentials.locked_until;

  RETURN QUERY SELECT false, NULL::text, credentials.locked_until;
END;
$$;

REVOKE ALL ON FUNCTION firehouse.verify_portal_login(text, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION firehouse.verify_portal_login(text, text, uuid) FROM anon;
REVOKE ALL ON FUNCTION firehouse.verify_portal_login(text, text, uuid) FROM authenticated;
REVOKE ALL ON FUNCTION firehouse.verify_portal_login(text, text, uuid) FROM service_role;

CREATE OR REPLACE FUNCTION public.verify_portal_pin_for_login(
  p_email text,
  p_pin text,
  p_department_id uuid
)
RETURNS TABLE(ok boolean, user_id uuid, email text, locked_until timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  verification record;
  verified_user_id uuid;
BEGIN
  SELECT * INTO verification
  FROM firehouse.verify_portal_login(p_email, p_pin, p_department_id);

  IF NOT coalesce(verification.ok, false) OR verification.email IS NULL THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::text, verification.locked_until;
    RETURN;
  END IF;

  SELECT auth_user.id INTO verified_user_id
  FROM auth.users AS auth_user
  WHERE lower(auth_user.email) = lower(verification.email)
  LIMIT 1;

  RETURN QUERY SELECT verified_user_id IS NOT NULL, verified_user_id, verification.email, NULL::timestamptz;
END;
$$;

REVOKE ALL ON FUNCTION public.verify_portal_pin_for_login(text, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.verify_portal_pin_for_login(text, text, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.verify_portal_pin_for_login(text, text, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.verify_portal_pin_for_login(text, text, uuid) TO service_role;
