CREATE TABLE IF NOT EXISTS firehouse.portal_login_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  outcome text NOT NULL CHECK (outcome IN ('success', 'failed_pin', 'session_failure', 'unlock_failure')),
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS portal_login_audit_department_time_idx
  ON firehouse.portal_login_audit(department_id, occurred_at DESC);

ALTER TABLE firehouse.portal_login_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS portal_login_audit_deny_direct ON firehouse.portal_login_audit;
CREATE POLICY portal_login_audit_deny_direct
  ON firehouse.portal_login_audit
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

REVOKE ALL ON TABLE firehouse.portal_login_audit FROM PUBLIC;
REVOKE ALL ON TABLE firehouse.portal_login_audit FROM anon;
REVOKE ALL ON TABLE firehouse.portal_login_audit FROM authenticated;
REVOKE ALL ON TABLE firehouse.portal_login_audit FROM service_role;
REVOKE ALL ON SEQUENCE firehouse.portal_login_audit_id_seq FROM PUBLIC;
REVOKE ALL ON SEQUENCE firehouse.portal_login_audit_id_seq FROM anon;
REVOKE ALL ON SEQUENCE firehouse.portal_login_audit_id_seq FROM authenticated;
REVOKE ALL ON SEQUENCE firehouse.portal_login_audit_id_seq FROM service_role;

CREATE TABLE IF NOT EXISTS firehouse.portal_login_audit_status (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  enabled_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO firehouse.portal_login_audit_status(singleton)
VALUES (true)
ON CONFLICT (singleton) DO NOTHING;

ALTER TABLE firehouse.portal_login_audit_status ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS portal_login_audit_status_deny_direct ON firehouse.portal_login_audit_status;
CREATE POLICY portal_login_audit_status_deny_direct
  ON firehouse.portal_login_audit_status
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

REVOKE ALL ON TABLE firehouse.portal_login_audit_status FROM PUBLIC;
REVOKE ALL ON TABLE firehouse.portal_login_audit_status FROM anon;
REVOKE ALL ON TABLE firehouse.portal_login_audit_status FROM authenticated;
REVOKE ALL ON TABLE firehouse.portal_login_audit_status FROM service_role;

DROP FUNCTION IF EXISTS firehouse.system_health_login_audit();

CREATE FUNCTION firehouse.system_health_login_audit()
RETURNS TABLE(
  monitoring_since timestamptz,
  attempt_count_24h bigint,
  failed_count_24h bigint,
  last_event_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT firehouse.has_department_access() THEN
    RAISE EXCEPTION 'Stickney department access required' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    status.enabled_at,
    COUNT(audit.id) FILTER (WHERE audit.occurred_at >= now() - interval '24 hours')::bigint,
    COUNT(audit.id) FILTER (
      WHERE audit.occurred_at >= now() - interval '24 hours'
        AND audit.outcome <> 'success'
    )::bigint,
    MAX(audit.occurred_at)
  FROM firehouse.portal_login_audit_status AS status
  LEFT JOIN firehouse.portal_login_audit AS audit ON true
  WHERE status.singleton = true
  GROUP BY status.enabled_at;
END;
$$;

REVOKE ALL ON FUNCTION firehouse.system_health_login_audit() FROM PUBLIC;
REVOKE ALL ON FUNCTION firehouse.system_health_login_audit() FROM anon;
GRANT USAGE ON SCHEMA firehouse TO authenticated;
GRANT EXECUTE ON FUNCTION firehouse.system_health_login_audit() TO authenticated;
