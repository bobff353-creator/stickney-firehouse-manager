# CAD notifications: durable delivery and lower background traffic

## Scope and release status

Implemented in `D:\stickney-scheduler-member-release`, branch `codex/scheduler-member-release`, for the existing Stickney Firehouse Manager. Not deployed or migrated by this task. Earlier unpushed feed, GPS and recent-call changes were preserved; GPS was not changed here.

Verified target: `https://stickney-firehouse-manager.vercel.app`, Vercel project `prj_RTtTvD39FwyEGUovkPg8wxrdJCtF`, Supabase project `ukpdacqjmhvlhmrwxtcx`, department `14a76771-4c24-481b-8def-e6cce005c17b`. No new provider, service purchase, dependency or credential is needed. Uses existing VAPID, database and cron credentials.

## What changed

1. A genuinely new active incident creates one department/incident event and one job per eligible subscription in the **same PostgreSQL transaction**. Upserts, duplicate receipts, historical records present during migration, closed-call inserts and rolled-back saves do not produce extra notifications.
2. The CIS, bridge, Resend webhook and Resend recovery paths start a bounded worker with Next.js `after` after committing. Push-provider requests are no longer awaited on the dispatch response path. The normal path does not wait for a feed refresh or cron.
3. Workers use indexed pending-job lookups, row locks with `SKIP LOCKED`, unique event/subscription keys, 60-second leases and lease-token-guarded acknowledgements. Another server can recover an interrupted worker. A failed database acknowledgement does not falsely mark delivery successful.
4. Up to 50 provider calls run concurrently with eight-second timeouts. One atomic acknowledgement updates delivery states and subscription bookkeeping for the batch. Maximum four batches/200 recipients per worker invocation; larger backlogs continue on recovery runs.
5. Recipients must belong to the verified department, have an active current membership and unambiguous active employee record, and retain Respond permission. Current employee/rank overrides, end dates, banned/deleted identities and unsubscribes are checked. The existing trusted platform-owner exception is preserved. This matters: the live aggregate inspection found one active subscription, belonging to that owner, rather than an active membership-linked employee. No additional owner exception was introduced.
6. Each retry rechecks eligibility. The recorded recipient and credential fingerprint prevent a reassigned/rotated subscription from receiving a job created for a different identity. Personal test/registration routes also require current Respond permission; personal tests remain limited to the signed-in user's department subscriptions.
7. Stable notification tags and a device receipt cache suppress repeated display after an ambiguous provider acknowledgement. The cache keeps at most 200 IDs, not call details, and survives service-worker upgrades. A failed display never creates a receipt; blocked local storage does not suppress an alert.
8. TV mode no longer mounts its hidden Smart Alerts menu. Ordinary hidden tabs pause nonessential alert polling, cancel outstanding reads and refresh when visible or reconnected. Chief Board requests now have overlap protection, cancellation and a timeout, without changing their cadence.

## Recovery and limits

- Independent authenticated `/api/cron/cad-push` runs each minute. Only this exact GET bypasses browser-session middleware; it rejects missing/wrong `CRON_SECRET` before database access. Cron and immediate workers share the same claim mechanism.
- Network/429/5xx failures retry after 30, 60, then up to 120 seconds; the one-minute recovery tick can add scheduling latency. Normal delivery is immediate after the request; crash recovery is not guaranteed instantaneous.
- Jobs expire five minutes after enqueue, and retries send only the remaining provider TTL. This preserves the existing short-lived-call-alert policy rather than displaying an old call as new after a lengthy outage. Long outages, exhausted attempts and permanent provider errors can therefore leave an alert undelivered.
- 404/410 deactivates the dead endpoint. Other errors do not deactivate it. Logs/status fields record generic status codes, not endpoints, keys or raw provider responses.
- `accepted` means accepted by the push provider, **not** displayed, heard or acknowledged by a member. Provider acceptance and database persistence cannot be one atomic transaction. There remains a narrow crash gap between device display and saving its receipt; exactly-once audible delivery is not promised. Already in-flight pushes cannot be recalled when permissions change.
- Compact event and delivery history is retained for audit/deduplication; it is not a client cache and is not automatically deleted. Only pending states participate in the hot queue index. Agree on an archival policy if long-term notification receipt storage becomes significant.
- Push remains supplemental to the department's primary dispatch/radio system.

## Measured versus estimated savings

Local execution with 50 fictional eligible subscriptions measured 50 sends, one acknowledgement RPC and two claim RPCs (the second finds the queue empty). Previously the broadcast used one recipient query and one status RPC per endpoint: 51 RPCs at that recipient count. **Status-reporting requests drop from 50 to 1; total worker RPCs in this fixture drop from 51 to 3.** This is not a measurement of production SQL row operations or billing: durable jobs intentionally add database row writes and eligibility checks.

Browser verification measured zero `/api/alerts` calls from two mounted TV-board instances while both detected a simulated incoming call at the unchanged board polling cadence. The fixture holds informational feed requests to verify they do not block this call detection.

For two continuously running TV boards, removing a once-per-minute hidden menu is an estimate of **2,880 fewer requests/day, or 86,400 per 30 days**. The recovery cron adds **1,440 invocations/day, or 43,200 per 30 days**, normally doing a small indexed empty-queue check. Net of those two changes alone: approximately **1,440 fewer application invocations/day / 43,200 per 30 days**, before initial loads, retries, user activity and other existing feeds. This is arithmetic from configured intervals, not measured monthly usage or a dollar-savings promise.

## Remaining polling and opportunities

- Live Operations dashboard/duties/fleet reads remain every 30 seconds; Respond call checks remain every 10 seconds. No apparatus assignment logic, call detection interval, weather interval or permission refresh logic was reduced.
- Ordinary visible Smart Alerts remain at 60 seconds. Chief Notes/river reads retain their 30-second cadence and 12-second presentation rotation. Their new cancellation/overlap guard reduces unnecessary work on slow connections, not normal cadence.
- The existing fleet endpoint already selects only department-scoped apparatus fields. It was not replaced with a broad shared authenticated cache.
- Resend recovery still checks on the existing dashboard path. Further deduplication of that fallback, permission-aware board reference revisions and replacing the minute recovery check with a proven durable event trigger are separate opportunities; do not simply slow CAD fallback polling to save requests.
- GPS request volumes are unaffected by this change.

## Deployment procedure (approval required)

1. Reverify Git remote/branch, Vercel project/domain and Supabase project before release. Inventory unrelated unpushed changes; do not silently discard or include them in an unrelated release.
2. Apply `20260912180527_durable_cad_push_outbox.sql` **before** publishing upgraded ingestion. The migration does not backfill or enqueue alerts from the old application: upgraded writes explicitly opt in within their own transaction. The bridge/Resend paths use a materialized CTE, avoiding a new global payroll transaction lock. CIS retains its existing atomic receipt/incident batch.
3. Verify function/table presence, grants, pending index and existing database/VAPID/cron configuration without displaying secret values. Do not promote the app if the database migration is missing.
4. Deploy the approved source to the verified Vercel project. Confirm the production alias, build commit and independent minute cron. Keep the queue migration in place on application rollback; dropping it destroys pending work and audit evidence.
5. Confirm unauthorized cron access is rejected and authenticated recovery succeeds. Query queue counts/statuses server-side. A configured application health endpoint alone does not prove push health.
6. With explicit authorization for real test notifications, test one designated member device, duplicate ingestion, provider acceptance, device display/tap-to-Respond and reconnect recovery. Verify production membership/permission behavior and inspect expired/failed jobs. Do not broadcast fictional emergency records to members for testing.

A request already running in the previous deployment can still follow its old delivery path; the new release cannot retroactively supply it with durable deduplication. Verify the transition before claiming live reliability. No production migration, deployment, synthetic call or test push was performed in this task.

## Verification evidence

- Final verification: **631/631 tests passed** (`node --test --test-concurrency=2 tests/*.test.mjs`); production build exited 0 with successful compilation, TypeScript and 61 static pages. Focused lint passed with no output. The large portal component retains one pre-existing link-rule error and four hook warnings, confirmed against its unchanged Git HEAD; its only change here is conditional mounting of Smart Alerts. `git diff --check` passed.
- `tests/cad-push-outbox.test.mjs`: actual migration in isolated PGlite/PostgreSQL; rollback, duplicate upsert, lease/restart, stale acknowledgement, retries, expired jobs, recipient changes, owner exception, batching, query plan and direct-role denials. Includes actual authenticated bridge handler → real SQL adapter → PostgreSQL → actual immediate-worker orchestration → mocked provider → persisted acknowledgement. No real provider send occurs.
- `tests/cad-push-browser.test.mjs`: actual service-worker code with simulated device storage/display; duplicate restart, display failure, storage failure, bounded receipts and visibility/cleanup behavior.
- `outputs/cad-notifications/browser-results.json`: actual React components at 381px, 768px and 1520px; no recorded browser errors/overlays. Two board instances are in one isolated browser fixture, **not six physical devices or a 24-hour station test**. Hidden/visible events are simulated.
- `outputs/cad-notifications/targeted-tests.txt`, `full-tests.txt`, `build.txt`, `lint.txt`: reproducible verification logs. The separate `payroll-lint-baseline.txt` records existing lint findings in the unchanged HEAD version of the large portal component; this task changes only its Smart Alerts mounting condition.

Physical-device/OS delivery, hosted multi-process contention, real Vercel worker interruption and production health remain release acceptance checks. Local PGlite serializes requests; its concurrent-promise tests are not a two-connection hosted PostgreSQL stress test.
