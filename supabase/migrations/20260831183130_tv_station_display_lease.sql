CREATE OR REPLACE FUNCTION public.renew_portal_pin_unlock_for_user(
  p_user_id uuid,
  p_unlock_token text,
  p_station_display boolean DEFAULT false
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  updated_rows integer := 0;
BEGIN
  IF p_user_id IS NULL OR p_unlock_token IS NULL OR length(p_unlock_token) < 32 THEN
    RETURN false;
  END IF;

  UPDATE public.portal_pin_credentials
  SET
    unlock_expires_at = now() + CASE
      WHEN p_station_display THEN interval '30 days'
      ELSE interval '12 hours'
    END,
    updated_at = now()
  WHERE user_id = p_user_id
    AND unlock_token_hash = encode(digest(p_unlock_token, 'sha256'), 'hex')
    AND unlock_expires_at > now();

  GET DIAGNOSTICS updated_rows = ROW_COUNT;
  RETURN updated_rows = 1;
END;
$$;

REVOKE ALL ON FUNCTION public.renew_portal_pin_unlock_for_user(uuid, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.renew_portal_pin_unlock_for_user(uuid, text, boolean) TO service_role;
