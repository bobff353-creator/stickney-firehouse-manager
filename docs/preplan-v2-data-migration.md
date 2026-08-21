# Operational Preplan 2.0 data migration

## Safety boundary

Validate the additive migration against an isolated preview database and storage configuration before any production change. A Vercel preview that points to production data is not isolated. Production requires explicit authorization, a backup, and a scheduled change window.

## What is preserved

- Existing preplans, footprints, contacts, status, mapped features, feature photos, and linked identifiers remain in place.
- Each legacy preplan receives one default Arrival/Ground level.
- Existing features receive level relationships without changing identity.
- Existing records become published legacy records so firefighter access does not disappear.
- Missing rooms, hazards, floor plans, operational facts, and verification dates remain missing; the migration does not fabricate them.
- The migration updates `preplan_schema_version` but does not advance `runtime_bootstrap_version`.

The migration file is `supabase/migrations/20260820212759_add_operational_preplan_v2.sql`.

## Preview procedure

1. Confirm checkout, branch, remote, Vercel project ID, production SHA, and database target.
2. Export the production schema and record counts. Inventory private storage without printing secrets.
3. Create isolated Supabase preview database and private test storage.
4. Use only approved or sanitized records needed for compatibility checks.
5. Apply the migration twice to verify idempotency.
6. Run `npm run verify:preplan-v2` and `npm test`.
7. Verify relationships, RLS, anonymous denial, permission seeds, one Arrival level per legacy preplan, feature/photo associations, publication backfill, and both schema markers.
8. Exercise allowed and denied roles, upload/stream/delete a test image and PDF, and confirm failed metadata writes clean up test objects.
9. Complete the signed-in authoring-to-Respond and offline checks in `docs/preplan-v2-testing.md`.

## Production change window

1. Obtain explicit authorization and take a fresh database backup and storage inventory.
2. Record pre-change row counts and deployed SHA.
3. Apply the migration once.
4. Verify schema version, RLS, counts, legacy Arrival levels, feature/photo links, and published visibility before deploying compatible code.
5. Verify established owner and department sign-ins, a legacy preplan, a published revision, Respond matching, a private attachment, and offline refresh.
6. Record migration result, application SHA, deployment ID, and deviations.

## Rollback

Rollback application code first for an application-only failure. The database migration is additive; do not drop new tables during incident response. If data recovery is required, use the approved pre-change backup and preserve newer records for reconciliation.

The older `docs/preplan-v2-migration-runbook.md` remains a concise checklist; this document is the Phase 9 source of truth.
