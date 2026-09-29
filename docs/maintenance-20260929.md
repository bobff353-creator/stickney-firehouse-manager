# Maintenance release — September 29, 2026

## Changes

- The nightly preplan check uses an authenticated server connection and records starts, successes and failures. System Health warns when a run fails, does not finish or becomes overdue.
- Employee account setup distinguishes an invitation from verified activation and an employee link. Permission managers can link an existing verified department account without overwriting personnel contact emails. Ambiguous, ended and future employees fail closed. Bob's existing verified personal and work accounts are linked to his existing Robert Wyant record.
- Push readiness is specific to the current browser/device and checks the saved subscription. A test targets that device only. Provider acceptance is distinguished from the user's confirmation that the alert appeared.
- Current-staff warnings respect employment start/end dates in America/Chicago. Former employees remain in history.
- Builds embed the release commit and build time. Use `npm run deploy:production` from a clean, committed checkout for CLI production releases.
- Common inventory tasks appear first; inventory counts, air packs, reports, stock and configuration remain in More tools. Equipment and health timestamps use Central military time.
- Five public policies avoid repeated authentication evaluation; push subscriptions are visible only to their owner or a department administrator. Leaked-password protection was enabled in Supabase. Existing server-only tables remain inaccessible to browser roles.

## Validation

70 focused tests passed, including real SQL migration/identity cases, permission boundaries, cron success/failure recording, backup-state accuracy and single-device notification routing. Production build and targeted lint passed. The production run and browser checks are recorded separately in the local maintenance evidence directory.

## Recovery work still requiring setup

The Supabase monitoring credential expired. A replacement restricted to this project's Backups: Read permission is prepared in the dashboard; credential creation and secure entry require the account owner. Never commit or paste the key into chat.

Independent database and photo/file backups need a department-approved destination, access and retention period. Supabase database backups do not include stored file contents. A restore drill must restore a database and sample files into an isolated environment and verify counts, access controls and representative records before recording success. No restore or independent backup is claimed in this release.

Device notification enablement and actual arrival must be verified on each user's phone/browser. No department-wide notification was sent by these checks.

## Deployment and recovery

Both `20260929191326_reliability_and_account_setup.sql` and `20260929192831_owner_employee_account_link.sql` are additive and already applied to the Stickney project. Preserve their link records and job receipts when rolling back app code. They do not delete employee, payroll, incident or equipment history.

After deployment, check `/api/health` against the release commit, invoke the authorized daily-refresh job once, and confirm its completed receipt in System Health. A rollback to the prior deployment also restores its former cron behavior, so check background-job status explicitly.
