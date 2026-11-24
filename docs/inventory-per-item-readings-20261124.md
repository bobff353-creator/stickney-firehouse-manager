# Per-item inventory check readings — November 24, 2026

## Behavior

Container contents can now save a required quantity and several required fields together: expiration date, PSI, fill level and text. Selecting any field switches the item to Quantity + readings for each item. A required quantity of two produces Item 1 and Item 2, with a separate entry for every selected field. Crew members enter the actual count and observed result. Existing pass/fail, count and medication formats remain available. The full equipment editor also retains these requirements.

New checks snapshot the saved requirements. Existing in-progress checks and completed reports retain their original fields and observations. Missing units or unverified/expired readings remain issues and follow the existing comments, evidence, findings, repair and officer-review safeguards. PSI accepts 0–6000; recording a pressure or fill level does not infer operational adequacy. The crew records the observed result. Reading-based checks support 0–100 observed units and 1–100 required units.

## Source and database

The quick container editor, new contained-item form, full equipment editor, member preview and actual crew reading editor share the new configuration. The API validates field names and department scope, retains compare-and-save concurrency protection and preserves contained-item create retry IDs.

Migration 20261124233316_inventory_per_item_readings adds inventory_equipment.check_fields (empty by default), expands allowed response modes, and extends the existing SECURITY INVOKER snapshot/validation/atomic-save functions. It does not backfill operational observations or alter existing check snapshots. Existing RLS and function execution grants are retained. No dependencies, notification settings, purchases or private-file changes.

## Verification

- 232 focused inventory/security/fleet tests passed before the final full-editor validation adjustment. The final changed route and SQL models then passed 13 focused tests in total (6 route tests and 7 actual PGlite migration/function tests). TypeScript and production build passed; ESLint zero errors/warnings; diff check passed.
- Real SQL function tests require two dates/pressures/fill readings for quantity two, reject invalid PSI/levels and generic-pass bypasses, retain original snapshots after template edits, enforce stale-save/tenant permissions, and preserve existing historical observations. Medication tests continue passing.
- Localhost-only actual UI with fictional transport: changed a contained item to quantity two plus date/PSI/fill fields, saved its setup, opened a new crew inventory check, verified missing readings block completion, saved distinct values, and reopened the saved entry. A simulated save failure retained the draft; retry succeeded. Phone 390px and tablet 820px had no horizontal overflow; light/dark fields inspected. The fictional example screenshot is outputs/inventory-per-unit-saved.jpg.
- Live database mutation persistence and physical devices are not demonstrated by these fixtures. Production review will be read-only; no department test equipment or inspections are created.

## Release status

Completed; see production receipt below.

## Baseline

Department-scoped existing equipment columns: 1,674 records / 9b14062960f6e930ae0321fd995473bf. Checks: 29 / 0610a43b3518b2f5e5a17fe9d8f7b65f. Check items: 1,775 / b1619f178a4ac5c621cf0fa83e09313f. Equipment fingerprint excludes the newly added empty metadata column so that original saved values can be compared exactly.

## Migration verification

Applied through authenticated Supabase access to the existing Stickney project. Server migration version is 20261124233316; the local migration filename and SQL test reference were aligned with that server receipt to prevent duplicate reapplication. Pure function validation on production returned pass for a complete two-unit example without creating any records. RLS remained enabled on equipment and check items. All three changed functions remain SECURITY INVOKER. Existing anonymous EXECUTE grants were retained; the atomic save still requires auth.uid() and department writing permission, and server routes require a verified session/origin. No permission expansion was introduced.

Post-migration fingerprints of all original equipment columns, checks and check items exactly matched the baseline. The security advisor returned the same pre-existing groups/counts: 199 informational RLS-without-policy notices and 10 authenticated SECURITY DEFINER warnings on other functions. No new findings concerned this migration. This release does not claim a whole-project security audit. References: [RLS policy advisory](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), [function access advisory](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).

## Production receipt

- Source pushed: db950bfb33695df1464141de752904232dfcfebf, branch codex/watchline-complete-20261123.
- Vercel production deployment dpl_5RRak5C82csSQjtf9Xk9ApLkYPCx reached READY at that Git revision. Canonical and legacy production aliases assigned. Canonical /api/health returned db950bfb3369.
- Live verified-session read-only review opened EMS bag, edited Epinephrine without changing its values, and confirmed required quantity, check-entry mode and expiration/PSI/fill/text checkboxes. Canceled the edit and editor without saving. Screenshot: outputs/inventory-per-unit-live-settings.jpg.
- Post-release original equipment/check/check-item fingerprints matched the baseline. Automatic station and scheduling email/text enabled-rule counts both remained zero.
- The migration filename/test reference alignment and this release receipt are a subsequent documentation/metadata commit; the deployed application source is the SHA above.
