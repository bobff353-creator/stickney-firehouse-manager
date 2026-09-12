# Individual Air Packs & Bottles

Status: implemented locally. No migration, production data mutation, push, or deployment performed for this change.

## Verified target

- Source: `D:\stickney-scheduler-member-release`, branch `codex/scheduler-member-release`.
- Remote: `bobff353-creator/stickney-firehouse-manager`.
- Vercel: `stickney-firehouse-manager`, project `prj_RTtTvD39FwyEGUovkPg8wxrdJCtF`.
- Production: https://stickney-firehouse-manager.vercel.app/inventory
- Database: Supabase project `ukpdacqjmhvlhmrwxtcx`; inventory uses existing `public.inventory_*` tables.
- The existing, unrelated preplan layout fix was preserved.

## Member / administrator flow

Inventory → **Air Packs & Bottles** → Air packs / Air bottles / Weekly checks.

Each physical item has a department-unique, case-insensitive ID. Its record includes name, assigned apparatus and compartment, manufacturer, model, SKU/part number, serial number, barcode, purchase/in-service/expiration dates, last hydro test, next hydro due, equipment notes, and a protected equipment photo. Optional details are collapsed in the editor to reduce phone scrolling. Save opens the saved record.

Completed maintenance is linked to the equipment UUID, not its location or display name. It records service date, work performed, vendor, technician, cost if known, invoice, and next service due. Existing protected maintenance-document upload/download endpoints are reused for service records and receipts. Existing repair records also appear in the asset history. Recording past maintenance does not close an open repair, return equipment to service, or update hydro dates automatically.

Admin setup access is required to register/edit equipment. Repair management access is separately required to record maintenance or attach service documents. Members can view records and perform checks only with their existing check permission. All server requests retain the current authenticated department scope, same-origin protection, and existing server-only database boundary.

## Location and weekly checks

- An item follows its assigned apparatus's existing weekly air-check schedule. The Weekly checks view shows the day/time and whether the Operations Board feed is enabled. Admins can save the weekly day/time here; this uses the existing schedule → Due Now / Station Duties / Live Operations integration.
- A location without a schedule is explicitly labeled unscheduled. The application does not invent a department check day. Current location choices are existing eligible apparatus compartments; no fictional station or apparatus records are created.
- An optional checklist-position link identifies an existing template line; it is not added twice. “Additional item” creates its own line. Unlinked legacy positions remain required, so a partial asset register cannot silently remove required checks.
- Changing/removing a template position does not discard its registered asset: it becomes an additional line until the admin links a current position.
- New checks atomically snapshot item ID, label, and location. Moving, renaming, or retiring an item does not rewrite in-progress or historical inspections. Changes apply to the next check.
- The same ID remains reserved after retirement. Existing historical reports are not matched to new assets by guessed serial numbers or similar names.
- Hydro/expiration dates are shown and flagged when the recorded date is due. No hydro-test frequency, service-life rule, or serviceability determination is inferred. Hydro applies to the cylinder, not the harness. These informational dates do not generate separate operational-board duties; the saved weekly location schedule does.

## Data preservation and database implementation

Read-only production inspection found 70 active `air_pack` equipment rows among 1,630 equipment rows. These include grouped quantities and checklist positions, not an authoritative register of 70 uniquely serialized physical assets. None were converted, deduplicated, deleted, or reassigned automatically. Admins must enter each real physical item and its actual ID.

Additive migration: `supabase/migrations/20260912030430_individual_air_assets.sql` (created using the Supabase migration CLI).

- Reuses `inventory_equipment`, `inventory_work_orders`, equipment photos, and work-order documents.
- Adds nullable physical-asset fields and nullable historical entry links/snapshots; legacy rows remain valid.
- Unique partial indexes protect ID and assigned position; partial indexes support active location lookup and per-asset inspection history.
- `inventory_save_air_asset` validates department/location/position and uses optimistic version checks. Exact repeat saves are no-ops; stale edits and duplicate identities fail without overwriting another record.
- `inventory_start_air_check` creates a check and all its entries in one transaction, retaining legacy positions and replacing only explicit links. It serializes starts/moves within the department and resumes an existing in-progress check.
- `inventory_log_air_maintenance` records one completed service event with retry-stable identity; it does not modify asset readiness.
- All three functions are `SECURITY INVOKER`, have empty search paths, and revoke execution from PUBLIC/anon. Existing row-level-security policies remain enabled and unchanged.
- No new browser polling was added. The existing operations data refresh is reused. Saves within this panel refresh in the background so the editor is not unmounted and unsaved form values survive a failed save. Existing operations refresh and board refresh intervals remain; this is not a broader database-usage optimization release.

## Verification and limitations

Final results: **562/562 automated tests passed**; the final production build generated all 61 pages successfully; 26 focused inventory/fleet regression tests passed again after the mobile return-button correction; the three new client/helper files passed ESLint. Browser verification completed **88 responsive states** with no horizontal overflow or captured runtime errors. The audit found and corrected an air-check Back button hidden by the compact layout; it now has a separate visible return control. Test harness issues (native date filling and overbroad button selection) were corrected without changing department data.

Story: Inventory navigation → actual React asset/maintenance form → `/api/operations` action → department-scoped RPC / existing tables → refreshed asset detail and future check preview.

- Seven executable PGlite tests cover identity uniqueness, retry/no-op behavior, stale edits, tenant and location rejection, current permission gates, denied RLS inserts, date validation, maintenance retention through a move, unchanged readiness, legacy preservation, template/asset preview parity, and check-creation rollback. An EXPLAIN on a fictional data set confirms the active-location lookup can use `inventory_air_location`; this is not a production-performance measurement.
- Browser audit uses actual React components with explicitly fictional API responses. It checks member/admin views at 360, 390, 768, 1024, and 1280 CSS pixels, including lists, detail records, editor sections, weekly previews/settings, failed-save retention, maintenance save, reconnect warning, new asset creation, and registered ID propagation into a check. Navigation/previews do not issue writes. Results/screenshots: `outputs/air-equipment`.
- Native date inputs were assigned through DOM input/change events because the installed browser automation's fill command returned success while leaving native date fields blank. Native iOS/Android date-picker interaction and physical-device testing are not claimed.
- SQL persistence and browser flows are tested in separate isolated layers. Authenticated production end-to-end writes, file uploads/downloads, actual simultaneous multi-device database traffic, and the production migration have not been exercised by this change. Existing protected file endpoints are reused, not replaced.
- Production security advisors were read, not changed. Existing advisories remain (private/core tables without direct-client policies, older mutable-search-path/definer functions, and leaked-password protection). This migration adds no SECURITY DEFINER functions or public tables and does not weaken the existing security boundary.

## Release gate

Deployment approval was received September 11, 2026. The additive migration and subsequent service-reminder migration were applied to the verified Supabase project before publishing the new API. See `equipment-service-reminders.md` for production migration checks and remaining live-verification boundaries. Ask the admin to register/verify real asset IDs; do not insert fictional equipment into production for acceptance tests. The preplan layout changes are included in the same release.
