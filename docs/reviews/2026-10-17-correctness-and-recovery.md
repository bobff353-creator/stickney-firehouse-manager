# Correctness and recovery review — October 17, 2026

## Scope and source

Bob's October 16 instruction authorized safe source fixes and isolated regression
checks. This work does not authorize deployment, production writes, live security
changes, credentials, paid provisioning, or restore into production.

Local branch: `codex/firehouse-correctness-20261017`.
All implemented fixes and regression/CI changes are in commit
`c13979feff437d7f12bc4ab8dd3251ff7c212e24`.
Base: `f8466609294970261d74e717256675e367aff66b` (`codex/eso-review-fixes`).
Remote `main` was `e03428842255febd9a83539516a4d720265ce43c` when checked.
The worktree was clean before switching; neither remote branch was overwritten.

Vercel's current production deployment was `dpl_AmHgNY5EQM5AUU9yxbuoKsaivk3A`,
created through the CLI, with no Git source metadata. Its retained
`src/.release-source.json` (file `697f909a50d924a63f24d56a85a47b0f167be2ef`)
contains the full base commit above. Both `stickney-firehouse-manager.vercel.app`
and `test-firehouse-manager.vercel.app` alias that deployment. The test hostname
is production, not an isolated environment. A public health request returned 403;
no authentication bypass or credential was created. The retained release identity
establishes the source baseline; it does not independently attest every uploaded
byte or the state of the live database.

## Implemented fixes and evidence

| Defect | Reproduction / resulting behavior | Source and regression files |
| --- | --- | --- |
| Bridge incident and Daily Log saved in separate transactions; push scheduled before projection succeeded | Injecting a projection failure left one incident and scheduled push on the base. Now the entire transaction rolls back, no push is scheduled, and retry saves both records. | `app/api/dispatch-bridge/route.ts`; `tests/dispatch-bridge-reliability.test.mjs`; `tests/cad-push-outbox.test.mjs` |
| Bridge replay reopened cleared incidents | Base upsert explicitly set `active=1, cleared_at=NULL`. Now cleared and CIS-owned incidents are acknowledged without changing incident/log data or scheduling push. The guard is checked inside the same transaction, including projection statements. | Bridge route; `app/dispatch-daily-log.ts`; bridge regression above |
| Email webhook had the same split-save failure | A signed synthetic webhook on an untouched base left one incident after a forced log failure. Now incident, log, and durable outbox enrollment commit together; push scheduling follows commit. Invalid signature, failure, retry, and repeated delivery are exercised. | `app/api/resend-dispatch/route.ts`; `tests/resend-webhook-atomic.test.mjs` |
| Daily Log accepted malformed or non-quarter staffing times before rebuilding payroll | Actual route now rejects malformed, numeric, out-of-range, and off-quarter values with 400 before any write. Blank draft times remain supported; no new pay-duration or rounding policy is introduced. | `app/api/logbook/route.ts`; `tests/time-entry-validation.test.mjs`; `tests/portal-atomic-saves.test.mjs` |
| Manual payroll accepted hundredths outside 15-minute increments | Actual route now rejects non-quarter hours before writing. Valid quarter-hour and finalized-period behavior are covered by the existing actual-route/PostgreSQL suite. | `app/api/payroll/route.ts`; time-entry and atomic-save tests above |
| Callback approval silently rounded input (e.g. 2.1 to 2.0 hours) | Approval now validates the supplied quarter-hour value instead of changing it silently. Invalid input leaves the submission pending; retries, manual baseline preservation, finalized-period guards, and rollback remain covered. | `app/api/callbacks/route.ts`; `tests/portal-atomic-saves.test.mjs` |

No migration or security/access-policy change is needed for these fixes. No live
policy was modified. Existing database batches/outbox and authorization boundaries
are retained. Test fixtures were repaired where they omitted the department
resolver, login lookup function, or renamed holiday dependency; those fixture
repairs are separate from application fixes.

## Trace and acceptance boundaries

- Daily Log: `app/daily-log.tsx` → `app/api/logbook/route.ts` →
  `app/payroll-hours.ts` → atomic staffing/log/time-entry persistence.
  `20260908032620_portal_atomic_saves.sql` already advances log versions when
  linked calls/staffing change. The initially suspected missing CAD version bump
  was ruled out by this trigger; no redundant source change was made.
- Payroll: `app/api/payroll/route.ts` applies employee/manager scope and
  period-effective rates; `app/payroll-calculation.ts` calculates category pay;
  export/submission paths retain their existing immutable snapshots. The new
  `tests/payroll-access-boundary.test.mjs` executes GET/POST against synthetic
  PostgreSQL: another employee's requested ID cannot expand own-record reads,
  ordinary members cannot write either employee's pay, delegated managers can
  read authorized payroll, and permission removal denies access.
- Callback: saved call → rule evaluation → assigned reviewer or administrator
  plus payroll permission → compare-and-swap approval and payroll aggregate in
  one batch. Existing approval rules were not expanded.
- Acting Officer: Daily Log AO flag becomes allowance hours, separate from worked
  hours. Scheduler qualifications are distinct from authorization of a pay
  designation. No exclusivity/eligibility rule was invented from the UI.
- CAD: signed email / authenticated bridge / authenticated CIS → normalized
  incident → persisted incident + log + durable notification enrollment. CIS
  sequence/timestamp, duplicate, close, and out-of-order replay tests remain in
  the acceptance set. Bridge/email lack a confirmed vendor update-order contract;
  terminal bridge replay is protected, but arbitrary live packet ordering is not
  claimed solved. Recovery remains bounded and retryable in local fixtures.
- Inspections: private owner + department/session boundary → versioned report,
  evidence, team review, and explicit delivery workflow. Owner denial,
  cross-origin denial, private attachment isolation, and rollback tests passed.
  The private pilot was not opened to other employees.

The source's Chicago operational date changes at 06:00, with 06:00–06:59 lock
grace and locking at 07:00. New boundary fixtures exercise both DST offsets,
the repeated fall hour, and year rollover. Current shifts are 06:00–12:00,
12:00–18:00 and 18:00–06:00. This is a test of calendar attribution, not proof of
a department-approved elapsed-hour DST payroll rule.

Independent expected dollar examples already documented in
`docs/PAYROLL-MATH-2026-09-23.md` and asserted by payroll calculation fixtures are
43 regular/detail hours at $23 plus six $1 AO allowance hours = $995;
39 hours at $20 = $780; eight eligible holiday hours at $23 × 1.5 = $276.
The same document specifies straight-time Work Detail, one DPW multiplier,
period-effective rates, cents per pay line, and gross as the sum of those lines.
`docs/payroll-holidays.md` documents the saved calendar, no automatic observed
substitution, and Christmas Eve's overnight 18:00–06:00 window. These are existing
repository records of instructions, not newly obtained signed personnel policy.

## Verification

Follow-up: the 43 remaining failures from the first pass were investigated and
repaired in `2422aee5a9f22a471c43bc4f241f7ae5983d6f7e`. The failure classification,
additional behavior tests, exact policy questions and local restore evidence are
in `followup-failure-classification-and-policy-questions.md`. The acceptance JSON
records the final complete run: **`npm test` passed the build and 1,406 tests
with zero failures/skips**. The intermediate comparison below is retained
as evidence rather than the current release-test result.

- Node 24.19.0; committed lock installed with `npm ci --ignore-scripts` using a
  writable temporary npm cache. No packages or dependency versions changed.
- Focused isolated acceptance: **186 passed, 0 failed** across 25 test files.
  Includes actual handlers and PGlite transactions with synthetic data, replay,
  fault injection, concurrent deliveries/saves, roles, payroll, and recovery.
- TypeScript and changed-file ESLint passed; `git diff --check` passed.
- Production build passed (97 generated pages). First-pass full isolated suite:
  **1,360 passed / 1,403 tests; 43 failed**. Untouched base under the same isolation
  guard/dependencies: **1,343 passed / 1,397 tests; 54 failed**. Every remaining
  failed test name also fails on the base; there are no new failed names. These
  include stale source-text expectations and incomplete mocks (department request
  context, employment status, repair helpers, release metadata). They are retained
  as failures in that run, not skipped or weakened to manufacture a green run. This branch is
  **not release-ready at that point** until the full acceptance gate was reconciled.
  `acceptance-results-20261017.json` lists the exact remaining tests/files and
  comparison. The current run adds six test cases; fixture repairs also recover
  the previously broken atomic-save/outbox acceptance tests.
- Browser: synthetic localhost fixtures at 320/390/768/1280 pixels, light/dark,
  for Daily Log, Fire Inspections, and payroll holidays: **24 layout cases**,
  no page errors or page-level horizontal overflow. All eight holiday cases also
  preserved a draft after failed save and successfully retried. External browser
  requests were blocked. Screenshots/JSON are supporting local artifacts, not
  authenticated live acceptance. No UI defect was confirmed in these cases.
- Vercel's grouped runtime-error summary reported no errors for
  `/api/cron/dispatch-recovery` in the preceding 24 hours. That does not prove
  the cron ran, recovered anything, or restored data. Historical error claims
  remain unconfirmed; no production recovery invocation was made. A separate
  seven-day grouped query returned 13 generic recovery failures, last seen
  October 15 at 03:00:45Z on `dpl_2ofixqj38pYRGafmWkjsL6KwD488`, a different
  deployment. The generic message does not establish the provider/database root
  cause, or prove that it persists on the selected deployment.

`npm test` now builds and invokes `test:isolated`. Its runner strips inherited
service configuration and blocks fetch/TCP/TLS/UDP in test processes. Fixtures
supply synthetic mocks/in-memory PostgreSQL. This is defense in depth, not an OS
sandbox for arbitrary malicious test code. The manual-only GitHub Actions file
runs install, types, build, and isolated tests with read-only repository access,
no deployment step, and no service secrets. It was not pushed or run on hosted
runners. Enabling automatic triggers, required checks, or paid runner use needs
owner review. A push itself may trigger Vercel, so this handoff stays local.

## Decisions and unavailable evidence before release

1. Obtain the signed policy defining AO exclusivity scope (department-wide time
   overlap, shift, station or another scope), eligibility, exceptions and approval.
   Current payroll accepts AO flags; this review does not certify that policy.
2. Confirm DST pay (scheduled clock hours versus actual elapsed hours), exact
   partial-tour holiday/date attribution and any historical rounding exceptions.
   Existing formulas are preserved. Quarter-hour validation rejects invalid input
   rather than silently rounding or rewriting already-posted entries.
3. Original attendance records and approved payroll exports were not supplied or
   retrieved. Independent reconciliation of actual employee pay is **incomplete**.
   Missing or incomplete original time records must be flagged, not reconstructed
   from schedules or current database totals.
4. The inherited full-suite failures have been repaired; final results are in
   the acceptance JSON. Do not treat an RLS table/bucket count as access-control proof;
   verify actual deployed policies, function grants, direct Data API and storage
   behavior for each role in an approved isolated environment.
5. Confirm an isolated staging target and a usable backup/restore path using the
   companion plan. A synthetic local database/file restore passed in the follow-up;
   a production-backup/Supabase restore remains unverified.
6. Parent must request any consequential action: pushing (deployment hooks),
   release, applying any future policy migration, production access/configuration,
   backup/export of sensitive records, external credentials or paid provisioning.
