# Preplan 2.0 Architecture Notes

This document tracks the real, as-built architecture for the Field Preplans /
Respond upgrade, and what has actually shipped so far vs. what remains. It is
written from direct inspection of this repository, not from the original spec
(which described a Postgres/Drizzle-schema architecture the codebase does not
actually use — see "Corrections to the original spec" below).

## Corrections to the original spec

The build request assumed:
- A `db/postgres-adapter.ts` file and a Postgres runtime — **does not exist**.
  The actual runtime is a SQLite-dialect binding (libSQL/D1-style,
  `db.prepare(sql).bind(...).run()/.all()/.first()`) accessed through
  `getDatabaseBinding()` in `db/bootstrap.ts`.
- Drizzle schema definitions for preplans in `db/schema.ts` — **does not
  exist**. `db/schema.ts` has no `preplan` tables at all. All preplan tables
  are defined as raw SQL DDL directly inside `db/bootstrap.ts`.
- `app/preplan-contacts.ts` — does not exist; contact info currently lives as
  a free-text field on `field_preplans` (`contact_info`).
- A test suite that exercises a real database — it doesn't. Every existing
  test in `tests/*.test.mjs` is either pure-function unit testing or
  source-text assertions against the actual `.ts`/`.tsx` files (regex
  matching against `readFile` output). There is no in-memory/test DB harness
  in this repo today.

All new work follows the **real** conventions found in the repo, not the
spec's assumed ones.

## Existing conventions this build follows

- **Idempotent migrations**: `try { ALTER TABLE ... ADD COLUMN ... } catch {}`
  per column, `CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS` for
  new tables.
- **Backfill gating**: a `system_meta` key/value marker row per backfill
  (e.g. `preplan_footprint_metrics_version`), compared against a version
  constant; the backfill body only runs when the marker is stale, and writes
  the new marker at the end. This makes backfills safe to run on every cold
  start without repeating expensive work.
- **Fast path**: `ensureDatabase()` checks a single `runtime_bootstrap_version`
  marker and skips `initializeDatabase()` entirely once it matches — so every
  schema/backfill change requires bumping `runtimeBootstrapVersion` in
  `db/bootstrap.ts`.
- **Permissions**: `app/permissions.ts` defines the catalog and rank
  defaults; `db/bootstrap.ts` seeds `rank_permissions` rows via
  `INSERT OR IGNORE`. Because `hasPermission()` only falls back to
  `defaultPermissionsForRank()` when a rank has **zero** rows in
  `rank_permissions`, every new permission key must also get an explicit
  `rank_permissions` seed row — otherwise it silently evaluates to "denied"
  for every rank that already has other permission rows (which is all of
  them, post-launch). This is a real footgun in the existing design and is
  handled explicitly in the new migration.

## What has shipped (this pass)

1. **`app/preplans/levels.ts`** — pure-function domain module for preplan
   levels/layers: `LevelLayerType`, `PreplanLevel`, mandatory-Arrival-level
   defaults, delete guard (`canDeleteLevel`), reorder logic that always pins
   Arrival first, duplicate-level logic that never shares mutable state with
   the source.
2. **`app/preplans/lifecycle.ts`** — pure-function domain module for the
   draft → in_review → published → archived state machine, the
   permission key required for each transition, and legacy-status backfill
   logic (`backfillLifecycleStatus`) that maps any pre-v2 `status` value to
   `"published"` so no existing preplan silently disappears from Respond.
3. **`db/bootstrap.ts`**:
   - New table `field_preplan_levels` (id, preplan_id, name, short_label,
     layer_type, floor_index, grade, sort_order, is_default, respond_visible,
     hidden, background_type/asset_key/transform, opacity, audit columns).
   - New lifecycle columns on `field_preplans`: `lifecycle_status`,
     `draft_owner`, `published_by`, `published_at`, `archived_by`,
     `archived_at`, `revision_number`, `last_verified_at`, `next_review_at`.
   - `backfillPreplanLevelsAndLifecycle()`: sets `lifecycle_status='published'`
     for every existing row with a blank lifecycle status, and inserts one
     Arrival level per existing preplan that doesn't already have one.
     Version-marker gated (`preplan_v2_levels_lifecycle_version`) so it is
     safe to run on every deploy without creating duplicate Arrival levels.
   - `runtimeBootstrapVersion` bumped to
     `stickney-runtime-bootstrap-2026-08-18-preplan-v2-levels-v1`.
4. **`app/permissions.ts`**: added `field_preplans.review`, `.publish`,
   `.delete`, `.manage_layers`, `.manage_hazmat`, `.manage_attachments`,
   `.verify_expiring`, `.manage_settings`. Officers (captain/lieutenant) get
   review/publish/manage_layers/manage_hazmat/manage_attachments/
   verify_expiring by default; delete/manage_settings stay chief/admin-only.
   `db/bootstrap.ts` seeds matching `rank_permissions` rows for every rank so
   the new keys are enforceable immediately, not silently denied.
5. **`tests/preplan-levels.test.mjs`** — 16 tests covering the level domain
   logic, lifecycle state machine, legacy backfill mapping, and source-text
   assertions confirming the migration/permission wiring landed in
   `db/bootstrap.ts` / `app/permissions.ts`.

## Verified

- `npm test` — all tests pass except two pre-existing baseline failures
  unrelated to this change (see below); the 16 new tests pass.
- `npm run build` — see completion report in the PR/commit message for the
  exact result at time of commit.
- `npm run lint` fails at baseline (`next lint` reports "Invalid project
  directory provided, no such directory: .../lint" — this is a pre-existing
  Next.js 16 / `next lint` incompatibility, not something introduced here).

### Pre-existing baseline failures (present before this change, not caused by it)

- `database bootstrap uses a durable fast path instead of repeating apparatus
  imports` (tests/*.test.mjs) — pre-existing.
- `renders development preview metadata` — pre-existing.

## Not yet built (honest remaining scope)

This pass delivered the **lifecycle + levels foundation** only — the part
every other Preplan 2.0 feature (rooms, HazMat, alerts, annotations,
attachments, hose-lay, risk scoring, CAD room matching, offline cache,
Respond UI, E2E tests) is built on top of. None of those are implemented yet.
Given the size of the full spec (20 requirement sections), the recommended
path is to continue in the same pattern established here — one vertical
slice at a time, each with its own migration + domain module + tests +
verified `npm test`/`npm run build` — rather than attempting all sections in
a single pass with unverifiable claims of completion.

Suggested next slices, in dependency order:
1. `field_preplan_spaces` (rooms) + CAD room/floor matching — needed before
   Respond can highlight rooms.
2. `field_preplan_alerts` (critical warnings/access problems/command notes) —
   highest safety value, relatively small surface.
3. Structured HazMat table + isolation zones.
4. Feature-to-level join table + migration of existing
   `field_preplan_features` rows onto the Arrival level.
5. Publication/revision snapshot tables and the actual publish/restore API.
6. Respond UI: critical banner, level switcher, CAD room match display.
