# Per-item inventory check readings — November 24, 2026

## Behavior

Container contents can now save a required quantity and several required fields together: expiration date, PSI, fill level and text. Selecting any field switches the item to Quantity + readings for each item. A required quantity of two produces Item 1 and Item 2, with a separate entry for every selected field. Crew members enter the actual count and observed result. Existing pass/fail, count and medication formats remain available. The full equipment editor also retains these requirements.

New checks snapshot the saved requirements. Existing in-progress checks and completed reports retain their original fields and observations. Missing units or unverified/expired readings remain issues and follow the existing comments, evidence, findings, repair and officer-review safeguards. PSI accepts 0–6000; recording a pressure or fill level does not infer operational adequacy. The crew records the observed result. Reading-based checks support 0–100 observed units and 1–100 required units.

## Source and database

The quick container editor, new contained-item form, full equipment editor, member preview and actual crew reading editor share the new configuration. The API validates field names and department scope, retains compare-and-save concurrency protection and preserves contained-item create retry IDs.

Migration 20261124180000_inventory_per_item_readings adds inventory_equipment.check_fields (empty by default), expands allowed response modes, and extends the existing SECURITY INVOKER snapshot/validation/atomic-save functions. It does not backfill operational observations or alter existing check snapshots. Existing RLS and function execution grants are retained. No dependencies, notification settings, purchases or private-file changes.

## Verification

- 232 focused inventory/security/fleet tests passed before the final full-editor validation adjustment. The final changed route and SQL models then passed 13 focused tests in total (6 route tests and 7 actual PGlite migration/function tests). TypeScript and production build passed; ESLint zero errors/warnings; diff check passed.
- Real SQL function tests require two dates/pressures/fill readings for quantity two, reject invalid PSI/levels and generic-pass bypasses, retain original snapshots after template edits, enforce stale-save/tenant permissions, and preserve existing historical observations. Medication tests continue passing.
- Localhost-only actual UI with fictional transport: changed a contained item to quantity two plus date/PSI/fill fields, saved its setup, opened a new crew inventory check, verified missing readings block completion, saved distinct values, and reopened the saved entry. A simulated save failure retained the draft; retry succeeded. Phone 390px and tablet 820px had no horizontal overflow; light/dark fields inspected. The fictional example screenshot is outputs/inventory-per-unit-saved.jpg.
- Live database mutation persistence and physical devices are not demonstrated by these fixtures. Production review will be read-only; no department test equipment or inspections are created.

## Release status

Pending source commit, migration, production deployment and read-only verification.

## Baseline

Department-scoped existing equipment columns: 1,674 records / 9b14062960f6e930ae0321fd995473bf. Checks: 29 / 0610a43b3518b2f5e5a17fe9d8f7b65f. Check items: 1,775 / b1619f178a4ac5c621cf0fa83e09313f. Equipment fingerprint excludes the newly added empty metadata column so that original saved values can be compared exactly.
