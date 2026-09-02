# FlowMSP import completion — 2026-09-02

The approved importer at `c3cf830` is combined with the deployed secure-access
repair at `92aad97`. The import route no longer attempts DDL through the protected
SQL query gateway. Schema changes use the reviewed FlowMSP migration. PIN and
department authorization remain enforced.

## Authorized source and persisted results

The saved 2026-09-01 FlowMSP exports contain 212 Stickney hydrants and 70 preplan
records. Reconciliation was checked against a fresh database snapshot. The import
ran through the connected administrative database access, independently of the
browser PIN, in one transaction with a stale-snapshot guard. A rollback-only
trial passed before the committed import.

- 212 hydrants inserted; all source UUIDs and GPS coordinates match exactly.
- 208 in service and 4 out of service, matching the source export.
- Provider-generated addresses remain display-only; no geocoding was used.
- Unknown ports remain unknown. Reported flows are retained as source notes,
  not fabricated flow-test results.
- 36 existing queue entries enriched without replacing original business fields;
  33 separate review entries added; 1 source entry linked to an existing built
  preplan. All 70 source payloads and UUIDs are retained exactly once.
- Six source records compete for three queue targets; they remain separate for
  review instead of choosing one match automatically.
- Existing 4 built preplans remain equivalent as JSON records; no new preplan was
  published. Total queue/history records after import: 151.
- Photos and drawing files were not present in these exports and were not imported.

Before/after snapshots, the exact transaction, the reviewed plan, and verification
receipt are retained in the local ignored `outputs/flowmsp-import-2026-09-02/`
folder, not committed to Git. The 379-test suite passed. Database security
advisors reported no findings on the affected hydrant/import tables.

The browser was still PIN-locked during database verification. Browser sign-in is
not bypassed or weakened; visual verification requires a user-unlocked session.
