# Database usage reduction — September 23, 2026

Project: Stickney Firehouse Manager, Supabase `datqzdndkrfyovhwppuq`, Vercel `prj_RTtTvD39FwyEGUovkPg8wxrdJCtF`.

## Cause and production changes

1. Application version conflicts used SQLSTATE `40001`. PostgREST 14.5 treated them as retryable database transactions, producing an unbounded retry loop. The live logs contained 47,981 matching errors between 21:35 and 21:43 UTC. Thirteen matching database connections were identified by process ID, backend start time, function, and query fingerprint. Some connections dated to September 15.
2. Applied `20260923215051_nonretryable_save_conflicts.sql` at 21:50:51 UTC. Both portal transaction wrappers and the physical equipment save function now use `PT409`, returning an HTTP conflict instead of retrying the same stale payload. Function definitions were compared by replacing the new error literal with the old one and hashing: all three matched their original definitions. Execution grants and SECURITY INVOKER were unchanged.
3. After application, all thirteen identified connections were absent; no manual termination command was necessary. The database itself was not restarted. A subsequent logs check covering 21:52–22:12 UTC found **zero** matching `40001` errors.
4. Applied `20260923221610_inventory_read_authorization_once.sql`. Nineteen inventory SELECT policies now evaluate the existing Stickney authorization helper once per SQL statement, rather than once per item. The same helper, authenticated role, restrictive server verification, membership and employee permissions remain in force. Other departments continue to use their existing department-specific checks. Results are not cached across requests.
5. The client-facing air asset error handler recognizes `PT409` while retaining old-code compatibility. It tells an editor to reopen a changed record rather than treating the conflict as an unknown error.

The migrations were created through the Supabase CLI. Their filenames were aligned with the versions assigned by the connected migration tool after application.

## Verification

- 18 transaction and inventory asset tests passed, including stale saves, atomic rollback, Daily Log/payroll writes, finalized payroll periods, unauthorized writes, and physical asset conflicts.
- 7 database permission tests passed. The new test compares all 1,000 fictional equipment rows before and after optimization; it also checks missing server verification, revoked permission, inactive membership, other-department membership, denied writes, policy preservation, and migration replay.
- Local PGlite query benchmark: 386.749 ms before and 2.636 ms after for 1,000 fictional inventory items. This is a local query measurement, not a claim about live CPU percentage or billing savings.
- A targeted repeat passed after migration filename alignment.
- Scoped ESLint and the production Next.js build passed.
- Live inventory contained 1,630 equipment rows and 1,544 check item rows before and after. The hash of all policies outside the optimized SELECT policies remained `a43e85c62c1e204d1588f08f0b9cadfc`.
- The signed-in production Inventory screen loaded and refreshed real records: 9 apparatus, 14 unfinished checks, and the existing shared progress. No operational check was submitted or altered to test this release.

## Cost and operational boundaries

No paid compute upgrade, plan change, storage deletion, security bypass, or change to crew refresh intervals was made. Stale-save protection and transaction rollback remain enabled. Cumulative query time is not CPU utilization; current CPU percentage and any invoice reduction require a new provider measurement after normal usage.

The main inventory queries previously averaged approximately 1.38 seconds for equipment and 1.14 seconds for check items over the cumulative statistics window. The retry loop was the larger immediate issue: the authenticated request-configuration statement had run approximately 276.9 million times since the statistics reset on September 14. These totals include historical activity and must not be described as current traffic.

Advisors were rerun after the policy migration. Remaining advisor items were not blindly removed: unused indexes may support intermittent workflows, and public security-definer helpers require individual authorization review. See [Supabase RLS performance guidance](https://supabase.com/docs/guides/database/postgres/row-level-security#rls-performance-recommendations), [security-definer helper guidance](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), and [leaked password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

The separate backup monitor permission issue and recovery readiness findings from the chief review are not fixed or disproved by this performance work.

## Provider reference and rollback

Supabase documents the matching [PostgREST retry defect and PT409 remedy](https://supabase.com/docs/guides/troubleshooting/high-cpu-and-infinite-transaction-retries-when-using-custom-error-codes-in-rpc-functions-77326b).

If SELECT policy behavior must be rolled back, restore only those nineteen SELECT `USING` expressions to `private.inventory_can_access(department_id)`. Do not restore `40001` application conflicts while affected PostgREST versions remain in use. Reverting the one-line application error mapping does not require reverting the database fix, but would reduce the clarity of the air asset conflict message.
