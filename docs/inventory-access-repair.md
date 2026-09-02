# Inventory access renewal repair

The portal launcher called a service-role-only renewal RPC through the public,
cookie-free system client. Production does not configure a service-role key.
This caused a 503 before navigation, and its shared error banner retried payroll
loading instead of Inventory.

The PATCH route now uses the authenticated member client and
`renew_own_portal_pin_unlock`. Identity comes only from `auth.uid()` in SQL.
The function requires active membership (or the existing platform-owner rule),
a matching unlock-token hash, and an unexpired lease. Anonymous execution and
direct credential-table access stay denied. The older for-user function stays
service-role-only. Neither PIN values nor token values are logged.

The Inventory-specific error now retries the launcher, can be dismissed, and
clears on navigation without touching unrelated page errors. A 423 still opens
the PIN lock; a 401 goes through Inventory's existing server-side sign-in gate.

## Validation

- Executable route tests cover success, caller-supplied identity rejection,
  missing/expired authentication, invalid unlock, RPC/network failures, and TV
  lease duration. SQL assertions cover own-user scope, expiry, and ACLs.
- Live database check: an authenticated member's invalid token returns false.
- Live ACL check: anonymous execution false, authenticated own-renewal true,
  authenticated for-user renewal false, direct credential-table access false.
- Security advisor 0029 flags authenticated SECURITY DEFINER functions. This is
  intentional here: only the narrow own-user renewal may update the otherwise
  inaccessible credentials table. Using SECURITY INVOKER would fail, and giving
  users direct table privileges would be broader. See the
  [advisor guidance](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).

This repair starts at production commit `535a9a4`; it does not include the
separate FlowMSP import change or alter inspection, staffing, or apparatus records.
