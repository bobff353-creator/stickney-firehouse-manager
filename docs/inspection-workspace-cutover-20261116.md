# Private inspection workspace replacement

This release replaces the private Fire Inspections workspace inside Stickney
Firehouse Manager. It uses the existing department patch, portal sign-in,
department boundary, inspection records, private evidence and ESO archive.
It does not import the separate Sites prototype's example properties or create
new operational properties from researched suggestions.

## Existing data and scope

The pre-release inventory contained 214 inspections (131 completed), one
reusable checklist, 221 inspection audit versions, 228 inspection file rows,
831 code-library entries and 834 code audit rows. The original archive has 208
ESO source records and 110 ESO file metadata rows; its private bucket has 318
objects totaling 183,025,382 bytes. There are 23 canonical field preplans.
These counts are a baseline, not a backup or proof of successful recovery.

The UI reads and writes the same canonical records and IDs. Existing completed
reports, contacts, source JSON, original signatures and files retain their
history. New building inspection profiles supplement preplans without silently
changing operational preplan fields or classifying legacy buildings.

## Resulting workflow

- Overview, work queue, appointment calendar, property directory, occupancy
  checklist builder, citation library, reports and recovery have direct routes.
  Phone navigation provides one workspace selector; lists are paged.
- One-checkpoint walkthrough, explicit findings and next steps, signatures,
  six/twelve-month routine cycles and one/two-month reinspection shortcuts.
- Occupancy letter groups, mixed uses and installed systems guide new visits
  and reference ranking. Saved reports keep their original wording and edition.
- Plain-language/typo-tolerant reference lookup, department favorites and
  retained citation versions. References still require adoption/applicability
  review; this release does not activate publisher or Brycer APIs.
- Separate owner/site-contact business-card images with original-byte checks,
  immutable history and camera/device/file inputs.
- Encrypted unsynced records and exact photos remain on the current device.
  Signed offline reports stay pending until their frozen evidence and final
  server version are confirmed. Retries reuse the same logical requests.
- Correction claims, proof review, verification, addenda and void notices are
  separate records tied to the exact issued version. Restored decisions are
  held for fresh review. Preserved historical PDF downloads remain available;
  email preparation and retries require the current active, unvoided version.

## Recovery and deployment boundaries

Applied additive migrations:

- `20261116034738_inspection_full_backup_recovery.sql`
- `20261116180210_inspection_staff_access.sql`

All new tables have RLS enabled and no direct application-role table grants.
The backup bucket is private. Backup jobs freeze inspection rows and original
evidence, including the ESO archive, historical reports and linked preplan
assets. ZIP entry sizes, scopes, hashes and references are checked before a
missing-only recovery. Different current records and bytes win over a restore.
Recovered delivery is held until explicitly reviewed and released.

Staff grants, owner bindings, provider receipts and worker claims are archived
for examination; recovery does not replay access or correspondence. Operational
preplans are included for separate review rather than automatically replaced.
This is an inspection backup, not a payroll/HR or whole-portal disaster restore.

## Intentionally held integrations

- `INSPECTION_EMAIL_SENDING_ENABLED=false` in Production and Preview. An explicit
  sender, provider configuration and enabled switch are all required to send.
  This does not disable unrelated portal authentication or dispatch email.
- Reminder scans create drafts only, including when sending is enabled later.
  The exact cron route checks its secret, department and Central-time gate.
- The signed inspection delivery webhook is implemented and tested locally;
  provider endpoint registration and actual delivery are separate acceptance
  steps. A configured URL alone is not a verified integration.
- Staff rollout remains disabled. Draft roster entries grant no access.
  Existing owner-only storage policies remain in force. Before enabling staff,
  complete and review storage policy activation, role-specific UI behavior and
  sign-in acceptance with the exact existing portal accounts.
- The claimed newer local code adoption remains subject to the actual
  ordinance/exhibit and authority review. No suggested group or checklist is
  automatically approved as an enforcement requirement.

## Verification and practical limits

Focused tests exercise actual PostgreSQL-compatible transactions, the SQL
gateway scanner, verified identity/host boundaries, stale versions, signed
evidence, lost acknowledgments, partial restore, provider signatures and races.
The browser fixture uses fictional local data and never writes department
records. Phone/tablet/desktop and dark/light inspection layouts were inspected.

Load and verify the workspace while connected before entering a building.
Connection-loss work in a loaded session is supported. A cold browser restart
without coverage still needs a connection to verify sign-in and reopen the
workspace. New signature timestamps describe server recording; an offline
signature is recorded by the server when its preserved payload synchronizes.
Original imported signature dates retain their source labels. Sign-out clears
encrypted device recovery; sync or export pending
records and original photos first. Physical iPad/phone camera, storage-pressure
and long-duration field acceptance remain distinct from browser emulation.

Release SHA, deployment outcome, live backup path/checksum and post-release
record fingerprints belong in the private release evidence, not this public
repository. Do not put department backups, roster emails or credentials here.
