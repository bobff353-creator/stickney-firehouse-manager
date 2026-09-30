# Stickney Firehouse Manager

This repository is the production Firehouse Manager at
https://stickney-firehouse-manager.vercel.app. It uses Next.js, Vercel, and
Supabase. Inventory and apparatus checks are at `/inventory`; the main portal
uses `?display=portal&page=...` routes.

## Project rules

- Preserve real and legacy department records, linked IDs, and private files.
  Never seed fictional operational records or silently replace saved work.
- Use the verified department session and existing permission boundaries.
  Keep every database and storage operation scoped to the authorized department.
- Keep credentials server-only and out of source, logs, reports, and chat.
  Local `.env` files and browser sign-ins are not part of the repository.
- Describe missing access and incomplete integrations truthfully. A configured
  endpoint is not a verified live integration until delivery and persistence work.
- Use plain labels and obvious next, back, save, and recovery controls. Check
  phone, tablet, desktop, light, and dark layouts when changing UI.
- Report source changes, test results, pushed commit, database migrations,
  production deployment, and live verification as separate outcomes.

## Development and verification

Use Node.js 24 and the committed package lock. Install with `npm ci`.

- Type check: `npx tsc --noEmit`.
- Production build: `npm run build`.
- Full tests: `npm test` (includes a production build).
- Inventory checks: `node --test --test-concurrency=2 tests/inventory-*.test.mjs
  tests/live-economy.test.mjs tests/suite-session-security.test.mjs
  tests/fleet-duty-integration.test.mjs`.
- Run ESLint on changed files and `git diff --check`.

Use the test commands appropriate to the change. Do not claim live database,
browser, email, push, dispatch, or deployment verification from fixtures alone.
Production access must be configured and explicitly verified.

## Cloud handoff baseline (September 30, 2026)

The latest verified production source at transfer time was commit
`caaf7fabff399665aa539b202bba91b35f5ad2aa` on
`codex/clear-first-screen-20260924`. Verify the chosen branch contains this
commit before continuing. This is a dated baseline, not a requirement to
discard later work or reset a branch.

That release pages completed inspection reports in groups of 25 using
`app/api/operations/history/route.ts` and `app/inventory-reports.tsx`.
`supabase/migrations/20260930030314_inventory_history_paging.sql` was applied
to production. Its read functions retain caller RLS. Current crew work includes
all unfinished checks and recent completed headers; completed item history is
loaded separately. Opening and printing a report retain every saved result.

136 focused tests passed, including tenant isolation, daylight-saving date
filters, stable paging after insertion, and a complete 1,005-result report.
The live release was verified through `/api/health`, the saved report list,
an older complete report, and apparatus filters. Recheck live state when needed;
these observations describe the transfer baseline.

For initial cloud acceptance, inspect this file, install dependencies, and
verify types, the production build, and the focused inventory tests. Do not
modify production records merely to prove the cloud workspace is usable.

## Publishing

Confirm the target Vercel project and Git revision before deploying. The
repository's `npm run deploy:production` script requires a reviewed, committed
working tree and records the release SHA. Use it only when deployment access
and publishing authorization are established. Confirm the production alias and
`/api/health` revision after a release. Use additive, reviewed database
migrations and verify their permissions and results.
