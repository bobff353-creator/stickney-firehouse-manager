# Isolated staging and restore-verification plan

Status: production staging/restore steps remain a reviewable plan. No service was
provisioned, production backup downloaded, security setting changed, or production
notification sent. The follow-up completed a synthetic local PGlite snapshot and
separate file-byte restore into a fresh database; see the follow-up report and
`tests/isolated-restore.test.mjs`. That exercise does not verify the production
backup, hosted Supabase Auth/Storage, PITR, or production RPO/RTO.

## Establish isolation first

Use an owner-approved local PostgreSQL/Supabase environment or an already funded,
explicitly approved separate project. Record the project/database identity and
endpoint, source commit, operator, and approval before loading data. Neither
existing public hostname is isolated: both currently alias production.

Bind a local application to localhost. Do not pull production environment files.
Use synthetic fixtures and accounts; do not copy department operational, personnel,
patient, incident, or private-file records into an unapproved environment.
Remove production Resend, SMS, CAD, push, tracking, and provider credentials;
disable all crons, external deliveries and automatic deployment hooks. Firewall
outbound traffic except explicitly reviewed local targets. Confirm that the app,
Data API, storage, workers, and browser all resolve exclusively to the isolated
identity before any mutating test. Distinct frontend hostnames alone prove nothing.

## Staging acceptance

1. Install the lock under Node 24; run types, build, changed-file lint, isolated
   tests, and resolve/triage every full-suite failure against the release base.
2. Apply reviewed schema history only to isolation. Verify foreign keys,
   uniqueness, transactions, log-version triggers, finalized-payroll guards,
   outbox deduplication and retry leases. Test legacy and isolated-department paths.
3. Use separate synthetic identities: unauthenticated, unapproved/PIN-locked,
   ordinary employee A/B, officer, assigned reviewer, delegated payroll manager,
   administrator, revoked member, and foreign department. Check positive and
   negative API, direct SQL RPC, Data API, function, view and storage access.
   Test object reassignment and revocation, not merely read visibility. Any policy
   fix becomes reviewed code; do not broaden live policies as a test shortcut.
4. Run the confirmed payroll examples, exact 06:00 boundaries, three shift edges,
   quarter-hour boundaries, holidays/year boundaries, and DST cases after approved
   policy is supplied. Reconcile to independently approved expected fixtures.
5. Replay duplicate, out-of-order, stale, close-before-update and concurrent CAD
   messages. Inject failure between receipt, incident, log and outbox writes;
   verify rollback and one durable notification per eligible recipient. No vendor
   endpoint or real notification is used during this step.
6. Exercise Daily Log draft recovery, lost responses, concurrent edits, offline
   retry and finalization; inspection attachment/report/team concurrency; and
   320/390/768/1280 widths in light/dark. A missing record or failed read must remain
   visibly unavailable rather than appear as zero, empty history or successful save.

## Restore drill (requires a separately approved backup source and destination)

First agree recovery objectives: permitted data loss (RPO), maximum outage (RTO),
backup scope/retention, encryption/access, operator and rollback authority. Inspect
backup availability and integrity through authorized read-only means. A backup
listing, dashboard status or successful export is not a tested restore.

Start with a synthetic dataset and a snapshot taken in isolation. Record a manifest
of primary keys, row counts, linked child counts, audit/version history, payroll
line totals, CAD receipts/outbox state, object keys and checksums. Delete/change
synthetic data in isolation, restore the snapshot **into a second empty isolated
destination**, and compare the entire manifest. Never restore into production.

For a later real-backup drill, obtain explicit approval for both sensitive export
and destination before copying anything. Restore database roles/schema/data using
the provider's supported method; separately restore private object bytes and
metadata if the database backup does not include them. Verify that bucket contents,
links, MIME types, and checksums match, and that access policies/functions/grants
were restored and still deny unauthorized identities. Do not assume PITR restores
storage objects, auth secrets, deployment configuration or external integrations.

Before starting the restored app, keep outbound workers/crons disabled. Recheck
all identities and endpoints, preserve closed CAD calls and historical timestamps,
and prevent restored pending outbox jobs from notifying real members. Compare
payroll totals and frozen submissions against the approved source manifest; open
old inspection reports and their attachments. Measure actual recovery duration
and recovered timestamp against RTO/RPO. Record mismatches and remaining gaps.

Evidence must identify snapshot time, backup identity, restore destination,
commands/tool versions, exit results, manifest comparisons, access checks and
sign-off without including credentials or sensitive record contents. Destroy or
retain the isolated restored data only under the approved retention plan. A failed
or partial drill blocks a claim of verified recovery. Release/promotion and any
live configuration/policy changes require a separate parent approval request.
