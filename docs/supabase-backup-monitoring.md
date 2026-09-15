# Supabase backup status — connection checklist

Scope: backup monitoring for the dedicated Stickney project
`datqzdndkrfyovhwppuq`, now configured for the main production app as well as the
verified preview. No independent file backup, off-site destination or paid add-on
is included. See `stickney-dedicated-supabase-migration.md` for the production move.

## What is implemented

- The administrator-only System Health API reads Supabase's documented
  `GET /v1/projects/{ref}/database/backups` using a server-only scoped token.
- The configured monitoring project must exactly match the app's Supabase URL.
  Mismatches, database keys and full-account classic tokens are rejected before
  any provider request.
- Only completed backups (or validated PITR recovery points) can be healthy.
  Missing, failed, malformed, future-dated, pre-import and over-36-hour-old
  recovery evidence cannot turn green. The 36-hour window allows a daily backup
  plus 12 hours of scheduling grace; it is not a claim of zero data loss.
- Provider reads happen only on an administrator's health-page load/refresh,
  with one 4-second-bounded request, no retries, no persistent stale-success cache,
  and no redirect following. Call, push, GPS and board polling are unchanged.
- Missing setup links directly to the correct project's Supabase backup page.
  Missing monitoring is not labeled as a failed database or disabled backup.
- Independent file/off-site/restore-testing controls say Not configured. They
  remain visible and are never represented as verified by a database backup.
- Failed health refreshes clear old green cards. Summary wording cannot claim
  services are online when a core service check failed.

## Secure connection and renewal

The user creates the credential in Supabase; do not reuse a full-account
CLI token, extract a signed-in browser token, or send keys in chat.

1. Open https://supabase.com/dashboard/account/tokens and Generate new token.
2. Name it `Stickney backup monitoring`. Keep Project resource access.
3. Select `bobff353-creator's Org` and only `Stickney- firehouse-manager`
   (`datqzdndkrfyovhwppuq`).
4. Start with No access; expand Database and grant only **Backups: Read**.
   Do not grant SQL, write, restore, billing, Auth, or other-project permissions.
5. Choose an expiry appropriate to department policy; Supabase initially shows
   7 days. An expired token produces an explicit warning, never an old green state.
6. Review scope, generate, and paste only the token into the protected ignored
   `.env.supabase-backups.local` line 2, after `SUPABASE_BACKUP_ACCESS_TOKEN=`.
7. Verify a real provider GET and compare the result to the dashboard. Deploy
   matching server-only environment variables to the target preview, test the
   authenticated health page, and separately approve any production release.

Variables: `SUPABASE_BACKUP_ACCESS_TOKEN`, `SUPABASE_BACKUP_PROJECT_REF`, and
optional `SUPABASE_BACKUP_REQUIRED_AFTER` (UTC). Never prefix these with
`NEXT_PUBLIC_`. For this migration the minimum point is the latest target
configuration transaction: `2026-09-15T01:34:58.527Z`. Advance it after final import.
The protected local file is not automatically loaded by Next.js; runtime variables
must be explicitly provisioned. Never commit or upload this local file.

## Provider evidence observed September 14, 2026

Supabase dashboard: dedicated project Healthy, organization Pro, one physical
backup at **2026-09-14 23:22:57 UTC** (6:22 p.m. Central). This predates the data
import/configuration and is not proof of backup coverage of the imported records.
Do not restore that older backup: it could discard the imported data.

Authenticated target-preview health was already showing the database, Auth
counts, storage and usage as working. The backup cards were unconditional
placeholders. A successful portal sign-in and migration copy are not recurring
backup receipts or a restore test.

## References

- https://supabase.com/docs/reference/api/v1-list-all-backups
- https://supabase.com/docs/guides/platform/personal-access-tokens
- https://supabase.com/docs/guides/platform/backups

## Connected preview — September 14, 2026

Historical preview evidence below predates the production cutover described at
the end of this document.

- The user-created token was saved into protected, ignored local configuration,
  without displaying its value. Supabase's permissions dialog confirms **Backups:
  Read, one project only**, with expiry **September 21, 2026**.
- At **2026-09-15 02:16:16 UTC**, `verify-supabase-backup-connection.mjs` made a
  real provider request through the application's helper. The result had a fresh
  verification timestamp and the completed **23:22:57 UTC** backup above. It was
  correctly **warning**, because that backup predates the import/configuration.
- Read-only negative probes returned **403** for the other project's backups and
  for unrelated settings on the dedicated project. No mutation was attempted.
- The token was supplied only as a server runtime environment variable, not a
  public or build variable. It was absent from 754 upload-source files and 140
  local browser assets scanned. Protected configuration and work directories were
  excluded from deployment.
- New preview: https://stickney-firehouse-manager-mmfqr7yre-fire-pre-plan-pro.vercel.app/?page=system-health&display=portal
- Deployment `dpl_CWKCinBQpo7XQGNQdnq6KJCa9ADp` is **READY**, with no production
  aliases. `/api/health` returns **200**, environment preview, dedicated project
  `datqzdndkrfyovhwppuq`. Signed-out `/api/system-health` returns **401**.
- The user signed in normally. At **2026-09-15 02:26:24 UTC**, an administrator
  clicked Refresh status and Vercel recorded **GET /api/system-health 200,
  cache=MISS**. The rendered card advanced to **9:26 p.m. Central**, displayed
  the real **6:22 p.m. Central** backup, and correctly warned that it predates
  the import. The refresh button re-enabled; no browser warning/error logs were
  returned by the scoped check. No session or PIN was copied or entered by the
  agent. The signed-in monitoring flow is verified, not backup coverage of the
  imported records or recovery testing.
- Production was rechecked and still points to `ukpdacqjmhvlhmrwxtcx`. No
  production environment, source data, backup schedule or paid feature changed.
  Source changes remain uncommitted/unpushed; this preview contains the working
  tree, not a new pushed release.

The token was supplied in a comment. Replace it promptly and place
the replacement directly into protected configuration, not chat. Its current
September 21 expiry will stop monitoring unless renewed; it does not disable
Supabase's own scheduled backups. Future deployments need matching server-only
monitoring variables; this preview's deployment-scoped configuration does not
configure production automatically.

## Acceptance status

52 focused tests passed, including provider/authorization/response tests with
mocked provider responses; the final 13 health-focused tests also passed after
cleanup. Targeted ESLint passed with no warnings. The Next.js production build
passed compilation, TypeScript, page generation and build traces. A local test
or build is not a provider connection or a deployment.
The 52 focused tests and targeted ESLint passed again with the connected token
configuration. The new remote preview build is READY. No independent photo/file
backup or restore test was set up.

### Signed-in verification, September 14 at 9:26 p.m. Central

Story: an authorized administrator opens or refreshes System Health, the protected
server endpoint reads dedicated-project backup metadata, and the UI displays the
actual recovery date without treating missing coverage as success.

| Boundary | Result | Evidence |
| --- | --- | --- |
| UI trigger | Passed | Signed-in page; Refresh status enters Checking and re-enables |
| Client to API | Passed | Deployed GET /api/system-health 200, cache=MISS, 02:26:24 UTC |
| API to provider | Passed | Server-only helper's real prior provider check; deployed card has a fresh verifiedAt |
| Provider result to UI | Passed | 6:22 p.m. backup, 9:26 p.m. check, pre-import warning and correct project link |
| Permission boundary | Passed for tested cases | Signed-out deployed request 401; scoped provider negative reads 403; focused authorization tests passed |

The summary correctly says Supabase services are online but database backup status
needs attention. Independent file/off-site backup and recovery testing remain Not
configured. These checks do not certify all application permissions or complete
the production migration. No additional deployment or production change was made
during this signed-in verification.

## Production connection — September 14, 2026, after 9:57 p.m. Central

The user authorized switching the main live app to the dedicated project.
Production Supabase settings and the three server-only monitoring variables were
saved permanently in the verified Vercel project. A new production build was
staged and promoted:

- Canonical URL: https://stickney-firehouse-manager.vercel.app
- Deployment: `dpl_71DsZSxQs7abNBDKiXDGrVh8eqWS`, READY.
- Canonical `/api/health`: HTTP 200, production, `datqzdndkrfyovhwppuq`.
- Signed-out canonical `/api/system-health`: HTTP 401.
- The refreshed main browser presents sign-in. Signed-in live health rendering
  still needs the user's normal sign-in; the equivalent target-preview flow was
  already verified above. No session or private PIN was transferred.

The saved required-after value remains `2026-09-15T01:34:58.527Z`, after the
operational import and target proof repair. No further operational record import
was needed; only one derived weather/board cache row was reconciled before
cutover. Later target cache refreshes are normal production activity.

Supabase's existing daily backup service was not rescheduled. **No 4 a.m. schedule
was set**, and no plan upgrade was purchased. Saved application records go to the
database when the app confirms Save; they do not wait for a nightly backup. The
health card can turn green only after fresh completed recovery evidence covers
the import. The last observed backup still predates it, so a warning is truthful.

The scoped Backups: Read token remains limited to this one project and expires
**September 21, 2026**. It was not rotated; replace/renew it through protected
configuration and redeploy before expiry. No independent file backup or restore
test was created. Source changes are deployed but remain uncommitted/unpushed.
