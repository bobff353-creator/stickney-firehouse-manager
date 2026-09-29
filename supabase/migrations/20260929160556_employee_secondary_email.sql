BEGIN;
ALTER TABLE firehouse.employee_profiles ADD COLUMN IF NOT EXISTS secondary_email text;
COMMENT ON COLUMN firehouse.employee_profiles.secondary_email IS 'Optional personal contact address; not a portal login identity or an automatic notification recipient.';
COMMIT;
