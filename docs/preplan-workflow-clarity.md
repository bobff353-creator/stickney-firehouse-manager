# Preplan workflow clarity and photo illustrations

## Status

Implemented on `codex/scheduler-member-release`, based on `0e7baa78c3b4c5fe582ca3cafe9d548d88cdd937`. The user approved release on September 12, 2026. The additive production migration is applied and verified; application deployment status is recorded in the release handoff. No operational records or FlowMSP records were edited.

Verified target: `stickney-firehouse-manager.vercel.app`; GitHub `bobff353-creator/stickney-firehouse-manager`; Vercel project `prj_RTtTvD39FwyEGUovkPg8wxrdJCtF`. This is the native Next.js portal, not a Sites deployment or another project.

## Member and administrator path

1. **Find & open a record** searches existing preplans and hydrants. **Finish imported addresses** explains which imported addresses still need field work.
2. **Building details** guides a new record through its footprint, address, contacts, and system summary. Existing records open at their editable details without requiring another footprint capture. Explicit Save, unsaved-state, and Preview saved preplan controls separate editing from reviewing saved information.
3. **Map equipment** is for actual building features such as FDCs, Knox Boxes, and shutoffs. Saved equipment can be selected for editing; changing its details does not move it unless the user explicitly places it elsewhere.
4. **A–D photos & symbols** names each exterior side, separates taking a photo from choosing an existing photo, and provides previous/next-side actions.
5. **Advanced details & review** retains the existing floors, rooms, hazards, files, and publishing tools. These capabilities have not been removed.

Section descriptions, next/back actions, and disabled-action explanations guide the next step. Forms and photo work use the available width instead of competing with the map. The map remains mounted and is shown again when map work is needed. App-provided exit/preview actions warn about unsaved edits; photo Cancel/Escape and page unload are also guarded. Native browser-history navigation is not a comprehensive unsaved-change blocker.

## Photo illustrations

Choose **Edit photo symbols & caption**, find a labeled symbol, and tap the image or choose **Place in center**. Select a mark to drag it, use arrow keys or position fields, resize, rotate, add a label, or remove it. Undo and Redo are available. Press **Save photo changes** to persist the edits.

- 31 original, labeled symbols cover sides, access, fire protection, utilities, hazards, arrows, circles, and text. These are visual aids, not a claim of compliance with a particular symbol standard.
- Illustrations are stored as normalized photo-relative coordinates. Original image files and their storage paths remain unchanged.
- No map pins, geographic locations, equipment records, or operational status are created by photo symbols.
- The same saved overlays appear in the preplan viewer and Respond exterior-photo views.
- Existing attachment-edit permissions and readable-preplan lifecycle checks are enforced by the API. Feature-linked photos are excluded from this exterior-photo editor.
- Opening an editor checks the latest saved metadata. Version-checked writes reject concurrent changes rather than overwriting another person's work. Failed saves retain the local draft.
- A real change updates the photo and parent preplan timestamp atomically. No-op and failed writes do not advance the revision. No additional polling was introduced; other Respond screens continue using the existing reference-refresh cycle, not an immediate push.

## Verification

- 153 preplan/Respond unit and integration checks passed. This includes handler authorization, lifecycle restrictions, input validation, version conflicts, and actual SQL execution in isolated PGlite for migration repeatability, no-op writes, rollback, and original-file preservation.
- 32 browser checks passed using explicitly fictional, preview-only records. Covered Save/Preview/Edit, failed saves, photo persistence after reload, concurrent edits, all four sides, symbol removal, and permission-based control visibility.
- Viewports checked: 1213×800, 1024×768, 768×1024, 390×844, 370×666, and 844×390. The audit checked page/modal overflow and runtime errors. Phone and tablet screenshots were visually inspected.
- Changed production TypeScript files passed ESLint with `--quiet`.
- Browser evidence: `outputs/preplan-workflow/results.json` and `outputs/preplan-workflow/photo-*.png` (local generated artifacts).
- Final `npm run build` passed, including TypeScript and generation of all 62 static pages. `git diff --check` passed.

These are controlled software checks, not a first-time-member usability study. Physical iPhone/iPad camera uploads, all advanced operational editor workflows, and production save/read round trips were not performed. The existing advanced tools remain available, but their internal workflows were not all redesigned in this pass.

## Required release order

Do not deploy the application before its additive database migration.

1. Obtain deployment approval and recheck the repository, Vercel project, and Supabase project `ukpdacqjmhvlhmrwxtcx`.
2. Apply `supabase/migrations/20260912222701_preplan_photo_illustrations.sql` to the verified project's **firehouse** schema using the established migration process. It adds `illustrations` and `illustration_version` to `firehouse.field_preplan_photos`; it does not modify the separate legacy `stickney_app` table. Do not recreate or delete existing tables or photos. This migration was applied through Supabase and its generated history version was synchronized to the local filename.
3. Verify both columns and unchanged access controls, then deploy the tested application commit to the verified Vercel project.
4. Verify deployment identity, health, authenticated preplan loading, authorized photo metadata reads, and Respond rendering. Any production test write must be explicitly approved and use a designated test record.
5. Report source push, database migration, deployment readiness, and live functional verification separately.

The new application selects the new columns, so deployment without the migration would fail photo reads. The additive columns may remain if the application is rolled back; do not drop them as a routine rollback.

## Production migration evidence

Supabase recorded migration `20260912222701` / `preplan_photo_illustrations`. Read-back confirmed text `illustrations` default `[]`, integer `illustration_version` default `0`, RLS still enabled, and policy `stickney_portal_access_field_preplan_photos` still present. The target photo table had zero rows before and after; no production photo-save round trip was possible without creating a test record. Existing legacy photos were not moved or changed.

The pre-release security advisor also reported pre-existing findings: 30 RLS-without-policy informational notices, five mutable function search paths, eight anonymous-callable and 25 authenticated-callable security-definer functions, and disabled leaked-password protection. These are a separate review opportunity, not changes introduced or repaired by this migration. References: [function search paths](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable), [anonymous function execution](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), [authenticated function execution](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
