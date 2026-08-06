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
  IF normalized_email !~ '^[^[:space:]@]+@stickneyfire[.]com$'
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
