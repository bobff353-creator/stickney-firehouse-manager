CREATE TABLE IF NOT EXISTS firehouse.portal_activation_attempts (
  email text PRIMARY KEY,
  failed_attempts integer NOT NULL DEFAULT 0 CHECK (failed_attempts >= 0),
  locked_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

REVOKE ALL ON TABLE firehouse.portal_activation_attempts FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.activate_roster_portal_user(
  p_user_id uuid,
  p_email text,
  p_department_id uuid,
  p_role public.department_role,
  p_pin text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  unlock_token text;
BEGIN
  IF p_user_id IS NULL OR p_department_id IS NULL
     OR lower(trim(coalesce(p_email, ''))) !~ '^[^[:space:]@]+@stickneyfire[.]com$'
     OR coalesce(p_pin, '') !~ '^\d{4,6}$' THEN
    RAISE EXCEPTION 'Invalid employee activation.' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM auth.users AS auth_user
    WHERE auth_user.id = p_user_id AND lower(auth_user.email) = lower(trim(p_email))
  ) THEN
    RAISE EXCEPTION 'Verified auth user is required.' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.department_memberships (department_id, user_id, role, status)
  VALUES (p_department_id, p_user_id, p_role, 'active')
  ON CONFLICT (department_id, user_id) DO UPDATE SET
    role = excluded.role,
    status = 'active';

  UPDATE public.department_invites SET
    status = 'accepted',
    accepted_by = p_user_id,
    updated_at = now()
  WHERE department_id = p_department_id
    AND lower(email) = lower(trim(p_email));

  unlock_token := encode(extensions.gen_random_bytes(32), 'hex');
  INSERT INTO public.portal_pin_credentials (
    user_id, pin_hash, failed_attempts, locked_until,
    unlock_token_hash, unlock_expires_at, updated_at
  ) VALUES (
    p_user_id, extensions.crypt(p_pin, extensions.gen_salt('bf', 12)), 0, NULL,
    encode(extensions.digest(unlock_token, 'sha256'), 'hex'), now() + interval '30 minutes', now()
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

REVOKE ALL ON FUNCTION public.activate_roster_portal_user(uuid, text, uuid, public.department_role, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.activate_roster_portal_user(uuid, text, uuid, public.department_role, text) FROM anon;
REVOKE ALL ON FUNCTION public.activate_roster_portal_user(uuid, text, uuid, public.department_role, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.activate_roster_portal_user(uuid, text, uuid, public.department_role, text) TO service_role;
