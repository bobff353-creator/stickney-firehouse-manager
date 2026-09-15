# Stickney Supabase move — main production app switched

Updated September 14, 2026, after 10:01 p.m. America/Chicago.

## Outcome

**The main live app now uses the dedicated Stickney Supabase project.** Permanent
Vercel production configuration was updated, a fresh production build was staged,
and it was promoted after data reconciliation. The canonical `/api/health`
returns HTTP 200 with environment `production` and project
`datqzdndkrfyovhwppuq`; Vercel resolves the canonical hostname to the new READY
deployment. The main browser was refreshed and presents normal sign-in.

The user previously signed into the target preview and verified System Health;
Inventory also rendered its nine migrated apparatus. A fresh main-domain member
sign-in and operational acceptance checks remain separate from the completed
configuration cutover. No PIN/session was copied between domains. Source changes
are deployed from the working tree but **not committed or pushed to GitHub**.

| Identity | Verified value |
| --- | --- |
| Production | https://stickney-firehouse-manager.vercel.app |
| Production deployment | `dpl_71DsZSxQs7abNBDKiXDGrVh8eqWS` |
| Immutable production URL | https://stickney-firehouse-manager-6ko30tjzl-fire-pre-plan-pro.vercel.app |
| Vercel project | `prj_RTtTvD39FwyEGUovkPg8wxrdJCtF` |
| Real checkout | `D:\stickney-scheduler-member-release` |
| Git | `bobff353-creator/stickney-firehouse-manager` |
| Branch | `codex/scheduler-member-release` |
| Base commit | `ddcbe0e35261886fd551e46592ab06f67360b2de` |
| Shared source, unchanged | `ukpdacqjmhvlhmrwxtcx` |
| Dedicated destination | `datqzdndkrfyovhwppuq` — Stickney- firehouse-manager |
| Preserved department ID | `14a76771-4c24-481b-8def-e6cce005c17b` |

The source was used only for read-only SQL and scoped file downloads. No original
records, files, keys, passwords, settings, or projects were changed or deleted.
No plans or paid add-ons were purchased.

## Copied snapshot

One REPEATABLE READ, READ ONLY export at **2026-09-15 00:58:14 UTC**
(September 14, 7:58 p.m. Central) contains **27,634 rows across 141 tables**:
139 application tables plus Auth users and identities.

| Records | Count |
| --- | ---: |
| Employees, including history | 50 |
| Employee profiles | 50 |
| Preplans | 9 |
| Hydrants | 212 |
| Pay periods | 8 |
| Time entries | 784 |
| Department apparatus | 9 |
| Inventory equipment | 1,630 |
| Inventory checks | 18 |
| Inventory check items | 1,512 |
| Schedule assignments | 1,473 |
| Station schedule entries | 2,953 |
| Station shift slots | 11,801 |
| Record revisions | 2,923 |
| Required Auth identities | 2 |

The actual app uses the `firehouse` schema and scoped public inventory/access
tables. The older `stickney_app` schema, CatNap, other departments, unrelated
Auth users, and their buckets were excluded. Auth relationship closure found a
second historical actor beyond the initial membership-only count of one.
No employee logins were invented.

Original IDs, password hashes, FK relationships, payroll/history, permission
settings, operational outboxes, indexes, constraints and triggers were preserved.
Old-project sessions, refresh/recovery tokens and remembered-device credentials
were not migrated. Users must sign in again; the source sessions remain intact.

## Restore and security verification

- Several rollback-only trials ran before the durable restore.
- Restore committed at **2026-09-15 01:14:29 UTC**. All 141 table row counts and
  SHA-256 canonical row-content checks matched the snapshot.
- RLS flags matched on all 139 application tables. Indexes, constraints,
  table/function privileges and security-definer/search-path metadata were checked.
- Broader destination default grants were replaced with exact source grants.
- One PostgreSQL-normalized AND constraint was proven equivalent with identical
  expression tokens and 4,913 null/boundary/out-of-range/infinity/NaN combinations.
- Nine private Storage policies and the authenticated apparatus Broadcast lease
  policy were retained.
- API testing caught a missing PIN-repair SQL helper. Dependency discovery now
  includes the used Edge Function. The exact helper was restored transactionally
  at 01:24:39 UTC, service-role-only. The final plan contains **73 functions**.
- `portal-pin-session` was copied from its live source version to the target.
  Its existing custom PIN authentication and `verify_jwt=false` were preserved.
  Unused shared Edge Functions were not blindly cloned.

Security/API probes passed: target Auth settings 200; anonymous inventory returns
an empty array through RLS; anonymous PIN RPC denied 401; invalid Edge Function
input rejected 400; public download of a private object denied 400.

Supabase advisors still report warnings for existing callable security-definer
RPCs and disabled leaked-password protection, plus informational RLS-without-policy
notices. This was not represented as a clean security audit; authenticated
permission enforcement still requires acceptance testing.

## Private files

All source/target file bytes were downloaded and SHA-256 compared. Object keys,
private status, file-size limits and allowed MIME types were retained.

| Bucket | Files | Verified bytes |
| --- | ---: | ---: |
| firehouse-portal | 17 | 2,063,479 |
| stickney-inventory-media | 7 | 2,649,182 |
| **Total** | **24** | **4,712,661** |

Employee paths were checked against real employee IDs; inventory paths use the
exact department UUID. One upload attempt failed; a resumable retry succeeded
without overwriting conflicting content. All 24 final copies passed verification.
Database export is not a substitute for a recurring independent file backup.

## Application and preview history

This section records the earlier preview stage; the production cutover below
supersedes its historical statements that production was unchanged.

Inventory now follows the shared Supabase configuration through the local
`app/lib/supabase-server.ts` correction, preserving server proof and cookies.
Its previous hard-coded project would have left Inventory on the shared source.

- Focused login/remember-device/legacy repair/Inventory/session/permission/health
  tests after the repair below: **42 passed, 0 failed**. Targeted lint passed.
- Rebuilt Vercel preview: successful compilation/TypeScript, READY.
- Current preview: https://stickney-firehouse-manager-mmfqr7yre-fire-pre-plan-pro.vercel.app
- Deployment: `dpl_CWKCinBQpo7XQGNQdnq6KJCa9ADp`
- This adds backup monitoring to the earlier corrected `75ly5pfv8` preview
  (`dpl_HSuoxT9rpqpvB9Uvdq5sV4chHibU`), where the user successfully signed in.
- The older `jpszxxb5s` preview is superseded; do not retry login there.
- Target: preview, no production aliases.
- Source: base commit above plus uncommitted working-tree changes, not a pushed
  migration release.
- Preview health: HTTP 200, environment preview, project datqzdndkrfyovhwppuq.
- Production health: HTTP 200, still ukpdacqjmhvlhmrwxtcx.
- Browser: the user signed into the new backup-connected preview. Refresh status
  returned HTTP 200 at 02:26:24 UTC; the visible card advanced to 9:26 p.m. and
  displayed the correct pre-import backup warning. No PIN or session was copied
  from the earlier preview. Avoid editing the staged copy.
- On the corrected preview, a synthetic nonexistent-account sign-in returns
  normal JSON HTTP 401, not a database exception. No error/fatal runtime logs
  appeared through 01:43 UTC. This is not a successful real-member sign-in or
  proof that authenticated workflows or dispatch work.

Only deployment-scoped preview target URL, public key, server-only key, department
and database URL were initially supplied. The existing Vercel PIN pepper remains
unchanged without export. The target-only internal server proof was corrected as
described below. No production configuration was changed. Scheduled Vercel jobs
were not invoked on the preview; no test notifications were sent.

### Corrected preview login configuration

The user's first attempt on the older preview produced HTTP 500 with
`Invalid portal database credential` before any PIN verification. The frontend
misreported the failed non-JSON request as an incorrect email/PIN.

- A new dedicated internal target server proof was generated into protected,
  ignored configuration. No member PIN, Auth password, database password, source
  credential, or production setting was changed.
- At 01:34:58 UTC, only the proof hash literal in
  `private.portal_server_request()` and
  `firehouse.execute_server_portal_sql(text,text,text)` was replaced, within a
  target-only transaction. Exact remaining definitions and ACLs were preserved.
  These two hash literals intentionally differ from source catalog parity.
- The correct proof accepts a harmless query; a wrong proof is denied. A correct
  request header without authenticated identity remains denied. Public Data API
  probes confirmed valid proof HTTP 200 and invalid proof HTTP 401.
- Read-only account comparison confirms the same user ID, PIN hash, and Auth
  password hash on source and target. The affected account has the existing
  platform-owner authorization, zero failed PIN attempts, and no lockout.
- Database verification failures now return HTTP 503 with a generic unavailable
  message, not an incorrect-PIN message or internal credential details. Real
  invalid credentials and lockouts retain their existing behavior.
- The rebuilt preview uses `STICKNEY_MIGRATION_TARGET_SERVER_PROOF` as its
  server-only `FIREHOUSE_DATABASE_SECRET`. Future target deployments must use
  this matching proof as well; never substitute the inherited source setting.

The user subsequently completed a real sign-in on `75ly5pfv8` and opened System
Health. This confirms that sign-in path, not every member role or operational
workflow. The user also signed into the new backup-connected preview; its
administrator health refresh is now verified end to end.

### Supabase backup monitoring

The new preview is READY and its public health endpoint confirms the dedicated
project; the signed-out protected health endpoint remains HTTP 401. A scoped
**Backups: Read / one project** token is runtime-only and expires September 21.
The real provider check at 02:16:16 UTC returned the latest completed backup at
**September 14, 23:22:57 UTC** (6:22 p.m. Central), correctly warning because it
predates the import/configuration. Other-project and unrelated-setting reads
were denied 403. After the user's sign-in, the deployed health request returned
HTTP 200 (cache=MISS) at 02:26:24 UTC and the rendered card showed the same real
backup date with a fresh 9:26 p.m. check time and the correct warning.

There is no independent file/off-site backup or restore test. Production and
its configuration are unchanged. Replace the comment-supplied token before
production use; never put its value in source or documentation. See
`supabase-backup-monitoring.md` for verification and renewal details.

## Production cutover — September 14, 2026

- Read-only source snapshots at 02:38:16, 02:52:30 and 02:57:20 UTC each contained
  27,634 scoped rows in 141 tables and the same 24 files. Three-way comparisons
  found no missing or conflicting employee, payroll, preplan, hydrant, inventory,
  rig-check, scheduling or call records since the initial import.
- The target's legitimate sign-in/unlock metadata and one remembered-device row
  were retained. One source Auth row changed only `updated_at`; no PIN, password,
  membership or permission change needed migration.
- All 24 private files were downloaded and rechecked against their source hashes:
  4,712,661 bytes matched. Storage-generated metadata differs as expected.
- One derived board-feed cache row was synchronized with compare-and-swap at
  02:56:06 UTC, without changing any other table. The post-switch comparison at
  03:01 UTC detects a newer target weather cache refreshed successfully at
  **03:00:26 UTC**. This is expected new production activity, not a missing record;
  the newer target cache was kept instead of overwriting it with the source's
  02:45 copy.
- All 15 existing CAD push deliveries remained `accepted`; no event was reset or
  replayed. No test call or push notification was sent. Existing immediate call
  processing and scheduled worker timings were retained.
- Target Auth Site URL is now `https://stickney-firehouse-manager.vercel.app/`.
  Only the source's two Stickney redirect entries were copied:
  `/auth/confirm` and `/auth/confirm**` on that same hostname. Other apps' redirect
  entries were excluded. Source custom SMTP and its email hook were both disabled;
  no new email service/hook was enabled. Actual email delivery was not tested.
- Nine permanent production variables were provisioned together: Supabase URL,
  publishable key, server key, target internal server proof, department ID, database
  URL, and the three backup-monitoring variables. Secret values used protected
  stdin/runtime configuration and were not included in deployment source.
  Existing PIN pepper, dispatch/Resend, VAPID, maps and cron credentials were kept.
- `vercel deploy --prod --skip-domain` built using production settings before
  `vercel promote` switched the main address. The remote build is READY.
- **102 focused tests passed, 0 failed**, covering backup/health, login/recovery,
  remembered devices, Inventory configuration, session/permission enforcement,
  CAD outbox concurrency and scheduler reminder delivery. These do not substitute
  for every real-role or operational end-to-end acceptance test.
- Canonical health is HTTP 200 and identifies the dedicated project. Signed-out
  canonical System Health is HTTP 401. No error/fatal runtime logs were found for
  the new deployment from 02:46 through 03:01 UTC. The main browser's refreshed
  sign-in screen is visible; a fresh user sign-in is still requested.

### Remaining operational acceptance and safeguards

1. Sign in normally at the main domain; verify authorized live reads/saves,
   private photos, roles/exceptions and employee workflows. Do not use the older
   shared-source deployment or preview for ongoing operational edits.
2. Re-sign in station TVs and rig devices. Verify the next real CAD event, push,
   assignment and GPS flow without manufacturing dispatch records or alerts.
3. Keep the shared source intact. The old immutable deployment is
   `dpl_CWEH21hMLB2irQPLhhAEH6HJpPc4` at
   `https://stickney-firehouse-manager-7kpry008y-fire-pre-plan-pro.vercel.app`.
   **Target writes now exist. Rollback requires data reconciliation**, not merely
   pointing back. Production environment variables also require deliberate
   rollback separately from an immutable deployment promotion.
4. Verify a completed destination backup newer than the imported records. The
   latest observed backup is still pre-import, so the warning is correct. Supabase
   provides daily backups; **4 a.m. was not configured**. A database backup does
   not include private file bytes. Independent file backup/restore needs separate
   destination approval.
5. Renew/replace the one-project Backups: Read token before its September 21
   expiry, directly in protected configuration, not chat. It was not rotated in
   this cutover. Monitoring failure does not disable Supabase's own backups.
6. Commit/push the reviewed source separately when requested. This production
   release contains preserved working-tree changes, not a new GitHub commit.

## Protected evidence

Credentials remain in ignored `.env.stickney-migration.local`, restricted to the
current Windows user and SYSTEM. Sensitive exports/receipts are similarly
restricted under ignored `work/supabase-migration-private`; tools and pinned
isolated dependencies are under `work/supabase-migration-tools`. Do not print or
commit these files. Deployment inventory explicitly excluded the credential
file, work directory, outputs and Git metadata.

Receipts include `restore-dry-run.json`, `restore-result.json`,
`pin-helper-restore.json`, `file-copy-result.json`,
`api-boundary-checks.json`, `final-target-metadata.json`,
`target-proof-configured.json`, `target-login-repair-checks.json`,
`preview-source-manifest.json`, `preview-deploy-output.json`,
`production-source-manifest.json`, `production-stage-result.json`,
`cutover-cache-reconciliation.json`, and timestamped `cutover-audit-*` reports.

Both DB connections verified TLS hostnames/certificates with the official
Supabase CA. No certificate checks were disabled. Previously pasted shared keys
should be rotated only after coordinating their consumers; none were revoked.

References used:

- https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore
- https://supabase.com/docs/guides/troubleshooting/migrating-auth-users-between-projects
- https://supabase.com/docs/guides/platform/backups
- https://www.postgresql.org/docs/17/app-pgdump.html
