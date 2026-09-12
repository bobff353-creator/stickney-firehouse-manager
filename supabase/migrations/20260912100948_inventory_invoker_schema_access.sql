-- Invoker RPCs resolve private.inventory_can_* while running as authenticated.
-- EXECUTE on those helpers alone is insufficient without schema USAGE (42501).
-- This grants name resolution only: no CREATE, table access, new function
-- execution, anonymous access, RLS bypass, or exposed Data API schema.
-- Existing helpers still enforce the trusted server request, current membership,
-- department scope, rank permissions, and member overrides.
GRANT USAGE ON SCHEMA private TO authenticated;
