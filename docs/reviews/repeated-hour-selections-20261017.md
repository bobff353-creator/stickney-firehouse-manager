# Explicit Chicago repeated-hour selections

Branch: `codex/firehouse-correctness-20261017`. Baseline remains verified deployed-source `f8466609294970261d74e717256675e367aff66b`. This follow-up supersedes the earlier limitation that first/second repeated-hour endpoints could not be recorded.

Implementation commit: `2115932f50a55d9c720b2d7af2c9942995214884`.

## Evidence and repair

The old HH:MM fields cannot distinguish November 1, 2026 01:30 CDT from 01:30 CST. Rejecting both prevented legitimate attendance from being recorded; choosing an offset silently could change payable hours or conceal overlapping acting-officer appointments.

Daily Log staffing and optional Work Detail suggestions now offer explicit occurrence/date choices with CDT/CST and UTC offset labels. Optional canonical UTC endpoint strings accompany the original clock labels. The server verifies each selection against the Chicago date/clock candidates. Missing ambiguous selections, stale/forged selections, nonexistent spring times, and nonpositive intervals fail closed. Changing date or clock clears dependent selections.

Independent expected examples: first 01:30 to second 01:30 is 1 hour; first 01:45 to second 01:15 is 0.5 hour; first November 1 01:30 to November 2 01:30 is 25 hours. An ordinary equal-label interval keeps its existing next-day 24-hour meaning. Operational staffing still uses the 06:00 boundary.

The same resolved instants drive actual payroll, holiday-window intersections, department-wide AO overlap checks, neighboring log snapshot races, review/submission reads, recovery comparisons, and edits. Exact handoffs are allowed; overlapping appointments are rejected. Saved selections survive API readback and reopening the form. Approved Work Detail manual totals and existing eligibility/approval policies are unchanged.

Historical protection remains: an explicit clarification preserving posted pay may be saved; an incidental change to previously posted clock-hour pay is rejected for correction review. No payroll backfill or finalized-history rewrite occurs.

## Changed files

- `app/staffing-time.ts`, `app/time-occurrence-select.tsx`: shared resolver and accessible explicit controls.
- `app/daily-log.tsx`, `app/work-details.tsx`, recovery files: editing, persistence, suggestions and recovery review.
- `app/api/logbook/route.ts`, `app/api/work-details/route.ts`, `app/api/payroll/route.ts`, staffing/payroll/submission/review modules: validation, stored fields, consistent payroll and overlap reads.
- `supabase/migrations/20261017004550_explicit_chicago_time_instants.sql`: additive review-only fields on existing department/template staffing and Work Detail tables; blank defaults preserve existing records. No updates, grants or policies.
- `tests/repeated-hour.test.mjs`, `tests/helpers/ao-dst-db.mjs`, related fixtures: isolated handler, migration, race, historical, recovery and payroll regressions.

## Acceptance and release prerequisites

Final `npm test` passed the production build and all 1,426 tests with zero failures, skips or cancellations. Changed-file ESLint and `git diff --check` passed. See `acceptance-results-20261017.json` and bundle logs. The repeated-hour focused run passed 21 tests with zero failures. Eight localhost browser cases (320/390/768/1280 pixels, light/dark) passed explicit one-hour/25-hour selections, ordinary defaults, spring-gap rejection and Daily Log save/reload, with zero page errors or horizontal overflow. Tests use synthetic data and local mocks/PGlite only.

Migration-first deployment is required: approve and test this migration in an isolated staging database, verify both existing and newly created department schemas, then approve production migration/deployment through the parent. The new application requires these columns; do not deploy it before the schema. The migration is additive and old application writes can use blank defaults. No migration was applied to production or any hosted database.

No push, deployment, production data write, live access change, credential creation or paid service occurred. The test hostname remains unsuitable as isolation because it aliases production. Original attendance/approvals and independently approved payroll exports are still required for historical reconciliation. The prior synthetic restore is not a verified production Supabase backup restore; an approved backup source, isolated destination and recovery objectives remain prerequisites.
