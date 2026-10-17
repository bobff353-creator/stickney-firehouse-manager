# Focused local Supabase acceptance

Recovered application source: `43e42d37da93f933f15adfba9e33d674b512f8df`;
source-backup revision: `272e39ed3423b559ff48a19b561a3f3cfa9d45ba`.

The user approved a local test environment without a paid cloud service.
Windows WSL 2.7.13 and Virtual Machine Platform were installed, and the required
restart completed. A dedicated `Stickney-Test` Ubuntu 24.04.5 distribution lives
on D:. Supabase CLI 2.121.0 runs a named native stack as an unprivileged test user.
This experimental runtime runs real PostgreSQL, GoTrue Auth and PostgREST.
Optional analytics, functions, storage, email and other services are excluded.
No production environment files, credentials, records or private attachments
were copied. Official download digests were verified.

## Fresh results

**34 real local integration checks passed.** The adjacent JSON lists each case.
They complement the previously rerun 67 isolated regression checks, production
build, standalone TypeScript, application lint, six browser workflows and six
responsive checks. This is not a rerun of the historical 1,427-test full suite.

- Three synthetic accounts were created through GoTrue and signed in through
  its password endpoint. Tests used real issued tokens and HTTP PostgREST RPCs.
- Anonymous requests, missing server proof, foreign departments, revoked
  memberships, direct table access and cross-schema SQL were denied. Revocation
  also invalidated access through an already issued token.
- Selected SQL executor and batch implementations were loaded from repository
  migrations. Only credential fingerprints were substituted with a new local
  test credential. Department and membership tables contain synthetic rows.
- The exact additive migration applied on PostgreSQL, added eight fields across
  both existing fixture schemas, and was idempotent. New schema clones inherited
  the fields through the same `LIKE ... INCLUDING ALL` structure-copy operation.
- Actual authenticated HTTP batches saved and read explicit occurrences; stored
  first/second 01:30 endpoints retained one elapsed hour. Invalid string formats
  were rejected. Failed batches rolled back earlier writes. Two concurrent saves
  accepted exactly one expected version and retained one staffing record.
- Background/server batches denied an incorrect credential, committed with the
  correct local credential, rolled back on partial failure and retained one row
  across retries.
- Reapplication preserved historical IDs, clock values, approved hours, existing
  explicit selections, RLS state and grants. Historical rows received blank
  defaults rather than guessed occurrences.

## Scope and remaining release decisions

The fixture does not reproduce every production table evolution, the complete
web/PIN/role matrix, the entire department-provisioning function, isolated
department background RPCs, hosted storage, vendor deliveries or disaster
recovery. The previously observed missing isolated server-batch RPC is outside
this migration; it has not been added or granted access. Default Stickney uses
the legacy schema. No production mutation or migration occurred during testing.

The production site still reported `f84666092949` after acceptance. Publishing
the complete recovered application requires applying only
`20261017004550_explicit_chicago_time_instants.sql` first. Do not apply the whole
historical migration directory or backfill payroll. The migration SHA-256 remains
`95af2c7659cbdec7747fdf0d213f5f934858343f744cd414e5c7d2352f5dc264`.

The prior rollback-candidate API denial has not been retried or bypassed.
Old application code can discard explicit selections on resave. After any new
occurrence record is saved, retain the additive fields and use a compatible
forward fix; do not blindly roll back to the earlier application or restore the
database. Live schema/application publication is separate from the source backup.

Local reproduction scripts and raw logs are retained under D:/ with the
`stickney-local-` prefix and `D:/stickney-local-test-evidence`. Local credentials
are deliberately excluded from Git and reports. Stop the named stack when idle;
stopping does not delete its synthetic data.
