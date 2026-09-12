# Equipment service schedules and reminders

## User workflow

1. Equipment → select the item → Edit complete asset record → Asset details. Air Packs & Bottles has the same fields in its asset editor.
2. Enter **Last serviced**, choose **Service every**, then choose **Show reminder in Due Now**.
3. Review the calculated next-service and reminder dates; press Save. Editing fields or switching sections does not write anything.
4. On the reminder date, the item appears in Inventory **Due Now**. It remains visible through the due date and overdue period. After actual service, update Last serviced and save to begin the next cycle.

Presets: yearly, 18 months, 2/3/5 years; custom 1–600 whole months. Reminder presets: on the due date, 1/2/3/4/6 months before; custom 0–120 whole months, shorter than the interval. No recurring reminder is the default. Turning reminders off retains the last-serviced date.

This is an **in-app Due Now reminder**, not email, SMS, push, or the portal notification bell. It does not add service reminders to Live Operations. Existing weekly checks and their Operations Board integration are unchanged. Repair completion is not automatically interpreted as scheduled service completion. Hydro-test records, service status, and historical maintenance records are not changed by these fields.

## Implementation and safety

- Three nullable fields on existing department-scoped `public.inventory_equipment`: `last_serviced_date`, `service_interval_months`, `service_reminder_months`.
- No defaults inferred from purchase dates, no backfill of fictional dates, and no conversion/deletion of existing records.
- Dates use America/Chicago for today and UTC date-only calendar arithmetic. Adding months clamps to the target month's final day; reminder months are subtracted from the calculated due date, not approximated as 30-day blocks.
- Shared input validation rejects invalid/future service dates, fractional/out-of-range intervals, missing anchors, and reminder lead times greater than or equal to the cycle.
- Database constraints enforce paired fields and bounds. An invoker trigger rejects changed future service dates at write time.
- Generic edits save the schedule with all asset changes in one UPDATE, require current setup permission, use department/id/version filters, and confirm the affected row before reporting success. No-op saves do not UPDATE. Lost races/access return a conflict, not a false success.
- Air assets include the schedule in the existing single, tenant-scoped invoker RPC with optimistic concurrency. Older clients omitting schedule fields preserve them.
- No new API endpoints, background timers, or extra database queries for reminders. The existing equipment response includes three more scalar fields. Existing Inventory refreshes recalculate reminder status and reload saved changes; no monthly-only cron that could miss a date rollover. Failed live refresh continues to show the existing stale-data warning.
- No index added: this feature uses the already-loaded equipment rows, so there is no new database predicate requiring an index.

## Verification

Story: asset editor → operations API → atomic asset save → refreshed equipment record → Due Now date evaluation.

- Date tests: month ends, leap years, all requested presets, custom intervals, Chicago midnight and DST, exact reminder/day-due boundaries, persistent overdue status, completion, disabled reminders and retirement.
- Actual route handlers tested with mocked authentication/database transport: current permission/origin denial, saved payload and readback, one scoped atomic air RPC, no-op update, rejected future/invalid data, failed writes, access loss, and stale versions.
- PGlite executes both pending migrations: atomic air saves, generic row constraints, rollback without partial edits, no-op retries, older-client preservation, tenant/permission failures, legacy records, linked historical records, and invoker/RLS coverage.
- Browser verification uses the actual React components with explicitly fictional API fixtures, not production records. 29 passing render states at 360, 390, 768, 1024 and 1280 px: generic editor, custom fields, air editor, read-only member reminders, Due Now, failed-save draft retention, completion, reconnection warning, and saved air record.
- Screenshots inspected for phone/tablet rendering. Browser date inputs were exercised using the native input value setter because this CLI cannot reliably fill native date controls; physical iOS/Android date-picker interaction is not verified.
- Browser artifacts: `outputs/service-reminders/`. Script: `scripts/audit-service-reminders.mjs` against the pre-existing local Vite fixture server on port 4181. No requests or writes to production from these fixtures.
- Final regression run: **576 tests passed, 0 failed**. Production `npm run build` passed, including TypeScript and all 61 generated pages. Targeted ESLint checks for the service fields/helper and changed air components passed.

## Release status

Source checkout: `D:\stickney-scheduler-member-release`, branch `codex/scheduler-member-release`, remote `bobff353-creator/stickney-firehouse-manager`. Vercel target `stickney-firehouse-manager`, project `prj_RTtTvD39FwyEGUovkPg8wxrdJCtF`.

Deployment was approved on September 11, 2026. Both migrations were applied to the verified production database at 03:04 UTC September 12, in the order shown by their filenames. Local filenames match the recorded remote migration versions. Post-migration checks confirmed all 1,630 inventory records and 17 checks remain, no asset IDs or service dates were invented, RLS remains enabled, and new RPCs are invoker-only with anonymous execution denied. Security advisors reported no new findings. Vercel publication and live health checks follow these migration checks; authenticated production saves still require an unlocked administrator session. Local route/SQL/fixture tests alone are not production end-to-end verification.

This release includes the earlier Air Packs & Bottles and preplan-layering fixes.
