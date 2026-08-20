# Stickney Operational Preplan 2.0 architecture

## Release boundary

This work starts from approved production commit `6227becd2154e778002289621214cab017063784` on branch `codex/preplan-operational-v2-approved`. The production deployment and production database are not migration or test targets. The schema migration must first be applied to an isolated preview database, validated, and only later promoted through an explicitly authorized production change window.

## Operational model

- `field_preplans` owns lifecycle, revision, construction, occupancy, fire-flow, verification, and target-hazard summaries.
- `field_preplan_levels` models Arrival/Ground, floors, basements, mezzanines, roofs, and site layers. Every legacy preplan receives one default Arrival/Ground level.
- `field_preplan_spaces` stores rooms/areas and aliases used for conservative CAD room matching.
- Existing mapped features gain level membership, normalized plan coordinates, severity, zoom priority, structured metadata, and effective/expiration fields.
- Alerts and HazMat records can attach to a preplan, level, and room. Hazard records refer to a pinned PHMSA ERG edition; the database does not invent ERG values.
- Annotations, private assets, photo annotations, HazMat zones, hose lays, risk factors, reviews, and immutable revision snapshots are separate normalized records.

JSON is stored as text at the portable query boundary and parsed by `app/preplans/domain.ts`. Dates are stored and bound as ISO text, then compared as instants in application code or with explicit database casts. Queries must never use `COALESCE` across text and timestamp types or compare uncast text directly to `date`.

The migration records its own `preplan_schema_version`. It intentionally does not change `runtime_bootstrap_version`; that marker belongs to the complete legacy bootstrap and advancing it from a feature migration would trigger an unnecessary full bootstrap on every server process.

## Lifecycle and publication

The publication states are `draft`, `in_review`, `published`, and `archived`. Respond consumes only published snapshots. Editing a published record produces a new draft revision; publication writes an immutable snapshot and increments the revision number. Archive is the normal removal workflow. Hard delete remains separately permissioned and must perform private-storage cleanup.

Existing records are backfilled as published legacy records so the current field view remains available. Their completeness status is visibly marked as legacy until reviewed; the migration does not fabricate missing rooms, floor plans, hazards, or operational facts.

## Permissions

Capabilities are independent: view, edit, publish, delete, review, manage layers, manage HazMat, manage attachments, verify expiring records, and manage preplan settings. Rank defaults are only a seed. Server-side rank permissions and employee overrides remain authoritative on every write.

## Private assets

The existing private `firehouse-portal` bucket remains private and department-scoped through RLS. The migration restricts new asset MIME types to JPEG, PNG, WebP, and PDF with a 25 MiB bucket ceiling. API handlers must also enforce per-kind limits, validate ownership before signing downloads, and store only object metadata in operational tables.

## Offline Respond cache

Only published response payloads are cached in IndexedDB, keyed by preplan and revision. Drafts, review copies, authentication data, signed URLs, and private attachment bodies are excluded. The UI must show the cached revision and timestamp and replace entries only after a successful authenticated fetch.

## ERG source boundary

The authoritative edition is PHMSA ERG 2024, effective April 4, 2024. PHMSA publicly provides the accessible PDF, while current `.xlsx` production files are available by request from PHMSA. The importer must pin the edition, source URL, effective date, and SHA-256, validate row counts and known records, and generate a local lookup artifact. Until a verified 2024 machine-readable source is imported, the UI may store a user-entered UN/NA number and link to the official ERG but must not display guessed guide numbers or protective distances.

## Rollout order

1. Create an isolated Supabase preview project/branch and apply `20260820212759_add_operational_preplan_v2.sql`.
2. Run schema, RLS, storage, lifecycle, and legacy-record checks with preview-only fixtures.
3. Deploy this Git branch as a Vercel preview configured only for the isolated database.
4. Verify Field Preplans and Respond end to end, including offline refresh and permission denials.
5. Export/back up production, schedule the migration, apply it once, then deploy compatible application code.
6. Promote production only after explicit authorization and a documented rollback check.
