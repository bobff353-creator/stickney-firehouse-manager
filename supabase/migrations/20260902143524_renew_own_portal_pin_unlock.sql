-- Renew only the signed-in member's existing, unexpired PIN unlock.
-- Keep the older for-user RPC service-role-only; do not expose an identity argument.
CREATE OR REPLACE FUNCTION public.renew_own_portal_pin_unlock(
  p_unlock_token text,
  p_station_display boolean DEFAULT false
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  updated_rows integer := 0;
BEGIN
  IF current_user_id IS NULL OR p_unlock_token IS NULL OR length(p_unlock_token) < 32 THEN
    RETURN false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.department_memberships membership
    WHERE membership.user_id = current_user_id AND membership.status = 'active'
  ) AND NOT public.is_platform_owner() THEN
    RETURN false;
  END IF;

  UPDATE public.portal_pin_credentials
  SET unlock_expires_at = now() + CASE
        WHEN p_station_display THEN interval '30 days'
        ELSE interval '12 hours'
      END,
      updated_at = now()
  WHERE user_id = current_user_id
    AND unlock_token_hash = encode(extensions.digest(p_unlock_token, 'sha256'), 'hex')
    AND unlock_expires_at > now();

  GET DIAGNOSTICS updated_rows = ROW_COUNT;
  RETURN updated_rows = 1;
END;
$$;

REVOKE ALL ON FUNCTION public.renew_own_portal_pin_unlock(text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.renew_own_portal_pin_unlock(text, boolean) TO authenticated;
