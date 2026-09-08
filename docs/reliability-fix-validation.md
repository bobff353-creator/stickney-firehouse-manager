# Reliability fixes — release validation

Release authorized by the user on September 8, 2026 (UTC). Both database
migrations have been applied successfully. The before/after record counts and
payroll-hour total were unchanged. Deployment status is verified separately.

## Changes

- Portal batches use one authenticated PostgreSQL RPC, with rollback on failure.
- Payroll entry triggers protect both old and new finalized periods and lock the
  period row against concurrent finalization. Empty Daily Log saves are guarded too.
- Daily Log saves require the loaded version; changes to staffing/calls advance
  that version. Conflicts pause editing and retain/download the local draft.
- Callback approval and payroll rebuilding are atomic; retries preserve the
  manual baseline. Submission counts reflect rows actually inserted.
- Inspection results, notices and repair orders save atomically. Parent locks
  prevent results changing after completion; empty checks cannot be completed.
- Officer handoff requires an active qualified officer and either that officer's
  authenticated identity or administrator authority.
- Failed payroll cells restore the last loaded value and retain a visible retry
  attempt. Review/finalization refuses unresolved saves.

## Verification

47 focused tests pass, including 9 database-engine tests using isolated PGlite
PostgreSQL fixtures. These execute the migration SQL and actual adapter, plus
Daily Log, payroll and callback route handlers. Failure injection covers earlier
write rollback, finalized entry insert/update/delete, stale versions, callback
approval failure, inspection/repair failure and duplicate-safe retries.

The remaining 38 tests include calculation tests, mocked request tests and older
source-pattern checks; they should not be mistaken for live acceptance tests.

Production build and TypeScript checks pass. Existing usability changes remain
in this worktree and are not discarded by this patch.

## Verification limits and release sequence

1. Migration SQL was tested against isolated PostgreSQL fixtures, not a full
   staging copy. Production schema installation succeeded.
2. Separate authenticated firefighter, officer and administrator session tests
   remain outstanding.
3. Verify save/reload, lost-response retry and two independent database sessions
   racing a save against another save or finalization. PGlite uses one connection;
   its overlapping requests prove stale-version rejection, not lock contention.
4. Applied `20260908032620_portal_atomic_saves.sql` and
   `20260908033045_inventory_atomic_item_result.sql` before deploying the client
   and API together. The new adapter intentionally has no non-atomic fallback.
5. Verify the production alias separately after deployment. Existing records are
   not repaired or rewritten by these tests; payroll has not been finalized.
