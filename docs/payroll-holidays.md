# Payroll holiday calendar

Payroll administrators with both the existing administrator flag and `payroll.manage` permission can open **Payroll → Manage payroll holidays**. The control is hidden in employee test views. Other signed-in department members can read the calendar through Holiday Policy; they cannot save changes.

The 13 screenshot names are offered as presets. Preset dates are actual calendar-date suggestions for the selected year, explicitly requiring administrator confirmation. No observed-day substitution is calculated. Existing built-in dates remain the fallback until an administrator saves a year; publishing this feature does not seed or overwrite production calendar records. A saved calendar replaces that year's fallback, including a deliberately empty selection.

Administrators can add a preset or custom holiday, edit its name/date, remove it from a draft, and save the calendar. Duplicate dates, normalized names, IDs and preset IDs are rejected. Dates must exist and belong to the selected year. Unapplied form entries and unsaved calendars warn before navigation. Failed or stale saves retain edits. A retry after a lost successful response returns the saved receipt without another audit entry.

Christmas Eve preserves the night-shift-only qualifier and the confirmed 18:00–06:00 America/Chicago window. Daily Log uses its existing operational shift date and `overnight` shift key. Actual eligible clock hours within that window go to `holiday`; the remaining worked hours go to `shift`. Each row's holiday hours plus regular hours equal its worked hours. A holiday lookup returns one date entry, and duplicate dates cannot stack premiums. Christmas Day keeps its existing all-shifts classification. Premium amounts, overtime thresholds, DPW rules, Acting Officer allowance and eligibility are unchanged.

The configured calendar is used by Daily Log's server-side synchronization and holiday banner, callback holiday context, Holiday Policy, and payroll-submission projections. Payroll holiday settings do not rewrite already-posted timesheet entries. Changes affecting dates in finalized payroll are rejected, including finalization occurring while a save is in flight. Existing Daily Log finalized-period guards remain intact. Open-period historical hours must be reviewed through the existing workflow if holiday dates are changed.

## Persistence and necessity review

No schema migration is necessary. The calendar uses existing `system_meta` keys `payroll-holidays:<year>` through the established department-scoped server database adapter. The value contains versioned holiday rows, actor and save time. Calendar compare-and-swap, the existing payroll source-version increment, and before/after `record_revisions` audit insertion occur in one existing atomic batch. This invalidates stale payroll projections while preserving immutable submitted copies. No auth policies, grants, credentials or employee access are changed.

## Verification

Run the focused payroll, Daily Log, callback and session/permission tests, types, changed-file ESLint and the production build. `tests/payroll-holidays.test.mjs` checks preset dates/year/leap-day edges, duplicates, Christmas Eve partial tours/midnight starts/24-hour tours, Christmas Day and unchanged DPW/AO pay. `tests/payroll-holidays-api.test.mjs` executes against fictional PGlite data and checks denied access/origins, finalized periods, competing saves, finalization races, atomic rollback, lost-response retries, audit and unchanged posted hours.

For browser checks, run `node scripts/preview-payroll-holidays.mjs` and open `http://127.0.0.1:4184/payroll-holidays.html`. The localhost-only fixture contains fictional data and does not call production APIs. Check add/edit/save/reload, duplicate feedback, failed/conflicting saves, year controls, read-only access removal, and light/dark phone layouts. Fixture evidence is not a signed-in production payroll verification.
