# Operational Preplan 2.0 preview release report

Report date: 2026-08-21  
Branch: `codex/preplan-operational-v2-approved`  
Baseline production commit: `6227becd2154e778002289621214cab017063784`  
Current preview commit: `3d341ed`  
Preview deployment: `dpl_9VxLp4pJEE4f4H3tGQu54bjqD4S3`  
Stable preview: `https://stickney-firehouse-manager-git-codex-p-337af3-fire-pre-plan-pro.vercel.app/?preplan=preview-ui-verification`

## Release status

The branch is a reviewable preview checkpoint, not an authorized production release. Production code, production aliases, and production data were not promoted or migrated. Automated gates pass. Current signed-in browser, isolated database/storage, migration, and destructive-cleanup acceptance remain outstanding.

## Implemented capability

- Normalized levels, spaces and CAD aliases, alerts, HazMat and zones, tactical annotations, private assets, photo annotations, hose lays, target-hazard factors, reviews, revisions, and settings.
- Structured construction and occupancy profiles with truthful unknown states.
- Draft, review, publish, archive, expiration review, and restore-as-new-revision workflows.
- Conservative CAD room matching and level suggestion in Respond.
- Critical warnings, target-hazard reasons, level-aware floor plans, HazMat, zones, hose lays, pinned attachments, mapped feature details, and quick building intelligence in Respond.
- Read-only, revisioned, department/apparatus-scoped IndexedDB Respond packets with explicit offline timestamps and sign-out clearing.
- Keyboard-operable tactical tabs and map alternative, accessible dialogs, reduced motion, 44-pixel actions, safe-area handling, and the required responsive source contracts.
- Legacy login compatibility and secure PIN reset remain covered by the portal regression suite.

## Architecture and persistence

The additive migration is `supabase/migrations/20260820212759_add_operational_preplan_v2.sql`, followed by `20260821034524_add_operational_preplan_v2_fk_indexes.sql`. It preserves existing preplans, features, photos, linked IDs, contacts, fire-flow data, and footprint data. Each legacy record receives one Arrival/Ground level and is backfilled as published without fabricating missing operational facts.

The migration advances `preplan_schema_version` and intentionally does not advance `runtime_bootstrap_version`. Operational JSON crosses the portable database adapter as text and is parsed in the domain layer. Date comparisons use validated instants or explicit database casts; text is not directly compared to `date`, and `COALESCE` does not mix text with timestamp types.

Respond reads published data only. Publishing creates an immutable snapshot and increments the revision. Restoring a snapshot creates another published revision instead of rewriting history.

## Permissions and security

The permission catalog adds independent view, edit, review, publish, manage-layers, manage-HazMat, manage-attachments, verify-expiring, delete, and manage-settings capabilities. Rank defaults seed access; employee allow and deny overrides remain authoritative server-side. Working-copy visibility requires ownership or edit/review/publish access, including direct photo and attachment routes.

Private assets use authenticated department-scoped routes, MIME and size allowlists, safe filenames and disposition, private cache headers, relationship validation, and best-effort object cleanup after metadata failure. Respond offline packets exclude credentials, signed URLs, draft records, and private attachment bodies.

## API and UI changes

- `app/api/field-preplans/operational/route.ts` provides validated operational reads and permission-gated actions.
- `app/api/field-preplans/assets/route.ts` and `[assetId]/route.ts` provide private upload, streaming, and deletion.
- Existing Field Preplans and Respond endpoints remain available.
- `app/preplans/operational-panel.tsx` provides persisted authoring and lifecycle controls within the existing building record.
- `app/respond.tsx` consumes saved published operational data without shipping demo records.

## Verification evidence

Commands executed from the verified worktree:

```text
npm run lint
npm run verify:preplan-v2
npm test
git diff --check
npx --yes vercel@latest inspect <preview-url> --wait --scope fire-pre-plan-pro
npx --yes vercel@latest logs <preview-url> --level error --since 10m --scope fire-pre-plan-pro
```

Results at the preview health-checkpoint update:

- Repository lint: passed with zero errors and zero warnings.
- Production Next.js build and TypeScript: passed; 53 routes generated.
- Complete portal suite: 286 passed, 0 failed, 0 skipped.
- Focused Preplan gate: scoped lint, production build, 110 passed.
- Preview deployment: Ready; stable branch alias attached.
- Runtime error scan immediately after deployment: no logs found.
- Working tree: clean except the existing untracked `supabase/.temp/` CLI metadata directory.

## Browser and acceptance evidence

No current screenshot or signed-in browser evidence is attached. The in-app browser controller failed before navigation because its local runtime could not write required kernel assets. This is not evidence that the portal passed or failed visual verification.

All seven scenarios remain tracked in `docs/preplan-v2-acceptance.md` as automated-contract-pass/manual-acceptance-outstanding. The role matrix, private upload/stream/denial/cleanup, offline reconnect and sign-out clearing, real viewport inspection, focus/contrast, and isolated migration checks are not complete.

The read-only environment findings are recorded in `docs/preplan-v2-environment-audit.md`. The isolated Supabase branch has no production-data copy; Operational Preplan tables, RLS, policies, markers, private bucket restrictions, and isolated fixture counts were verified directly. Vercel-to-branch request proof and resolution of the branch’s `MIGRATIONS_FAILED` status remain required.

## Exact production prerequisites

1. Provision and identify an isolated preview Supabase database and private test storage; confirm the preview does not point at production data.
2. Apply both migrations twice and record schema, RLS, index, relationship, marker, and legacy-row evidence.
3. Complete scenarios A–G and the firefighter/editor/reviewer/publisher/administrator/allow/deny role matrix with approved test records.
4. Verify valid and invalid uploads, authorized streaming, unauthorized denial, deletion, and failed-metadata object cleanup.
5. Verify offline cache, reconnect, revision/timestamp display, department/session isolation, and sign-out clearing.
6. Inspect 360×800, 390×844, 768×1024, 1024×768, 1366×768, and 1920×1080 with keyboard and reduced-motion checks; capture screenshots and console results.
7. Take a production backup and storage inventory, record row counts and current production SHA, approve a change window, and confirm rollback ownership.
8. Obtain explicit production-promotion authorization. Apply the migration and promote only after post-migration and established-login checks pass.

See `docs/preplan-v2-architecture.md`, `docs/preplan-v2-testing.md`, `docs/preplan-v2-acceptance.md`, `docs/preplan-v2-environment-audit.md`, and `docs/preplan-v2-data-migration.md` for the maintained operating detail.
