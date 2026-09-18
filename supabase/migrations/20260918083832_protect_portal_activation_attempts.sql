-- Server-only activation rate-limit records; no browser access is needed.
ALTER TABLE firehouse.portal_activation_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE firehouse.portal_activation_attempts FROM PUBLIC, anon, authenticated;
