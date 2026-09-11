# Inventory and Apparatus Checks usability audit

Date: September 10, 2026. This audit was completed before deployment; deployment status is reported separately.

## Verified project

- Source: `D:\stickney-scheduler-member-release`, branch `codex/scheduler-member-release`.
- Remote: `bobff353-creator/stickney-firehouse-manager`.
- Vercel project: `stickney-firehouse-manager`, `prj_RTtTvD39FwyEGUovkPg8wxrdJCtF`.
- Intended production alias: `https://stickney-firehouse-manager.vercel.app`.
- No production records, storage objects, permissions, schemas, or deployment settings were changed during this work.

## Changes

- Search apparatus before starting inventory; keep equipment search and selected-record details easy to find.
- Compact phone header/status cards, four main bottom destinations, and a labeled menu for every workspace, including administration.
- Split checklist administration into editing, adding items, due dates, air-pack templates, location requests, and member preview.
- Keep the selected apparatus/checklist context visible. New-item and due-date forms initialize from that context. Administrators can include other checklists when searching apparatus equipment.
- Divide the asset editor into Item & location, Check requirements, and Asset details. Keep unsaved form fields mounted across sections, validate the correct section, trap keyboard focus, support Escape, and restore focus after closing.
- Add Save & preview for existing checklist items. The preview uses saved template data and the same item-rendering function as the member check; all result controls are disabled and no inspection is created.
- Block preview when refresh fails. Distinguish a rejected save from a successful save whose refreshed records could not be loaded.
- Improve readable field sizes, touch targets, wrapping, dark-mode colors, the apparatus setup steps, and the completion bar above phone navigation.
- Show completed reports as labeled records on narrow screens; retain the tabular print layout.
- React review informed the event-driven editor state and focus handling. Browser verification exposed CSS ordering, clipped schedule controls, dark-mode contrast, and report-table clipping; these were corrected.

## Verification

The browser harness imports the actual application components and styles. API responses are isolated fictional fixtures; it does not connect to production data.

| Audit | Coverage | Final result |
|---|---|---|
| Main light-mode matrix | 135 member/admin states at widths 360, 390, 768, 1024, 1180 | No page-width overflow, off-screen controls in the measured set, or captured runtime errors |
| Dark-mode matrix | 54 member/admin states at widths 390 and 768 | Same geometry/error checks passed; representative screenshots inspected |
| Save and check workflows | 12 states at widths 390 and 768 | Passed |
| Apparatus configuration | 20 states: apparatus, compartments, photos, hotspots at all five widths | Passed |
| Inventory regression tests | 59 tests, including atomic result handling and existing permission/scope checks | Passed |
| TypeScript / targeted ESLint | Inventory shell, operations component, preview helper | Passed |
| Production build | `npm run build` | Passed |

Workflow assertions include required-field validation in a hidden editor section, preserving edits across sections, rejected saves retaining values, retry/save/preview, no preview writes, saved-but-refresh-failed messaging, refresh recovery, member admin-control exclusion, numeric and pass results, check submission, and opening the resulting report.

Read-only navigation and preview generated **zero fixture POST requests**. A failed save followed by a successful retry generated two attempted fixture writes; preview generated no extra write. These are measured local UI results, not production traffic measurements.

## Reproduction and evidence

1. Start the existing local Vite harness: `node scripts/preview-member-scheduler.mjs`.
2. Open `http://127.0.0.1:4179/inventory-audit.html` for a clearly labeled, fictional responsive preview.
3. Set `INVENTORY_AUDIT_BROWSER` to the installed agent-browser JavaScript CLI path.
4. Run `node scripts/audit-inventory-ui.mjs` and `node scripts/audit-inventory-flows.mjs`.
5. For the additional apparatus audit, open the fixture's admin Apparatus & locations workspace in the `inventory-flows` browser session, then run `node scripts/audit-inventory-apparatus.mjs`.

Screenshots and measured JSON are in ignored local folders `outputs/inventory-audit`, `outputs/inventory-audit-dark`, `outputs/inventory-flows`, and `outputs/inventory-apparatus`.

## Limits and deployment

- Responsive testing used Chromium viewport emulation, not physical iPhones, iPads, Android devices, or Safari. Real-device camera/barcode scanning, mobile keyboard behavior, photo upload/storage, printing, and email delivery were not end-to-end tested.
- Forms for photos, compartments, schedules, and air-pack templates were rendered and inspected; their production persistence was not exercised. The main edit/check workflow used simulated API responses. Existing API regression tests ran separately.
- Empty repair/stock/location-request states were inspected; this is not a claim that every possible historical record or large data set was rendered.
- Existing five-second operational refresh behavior was retained. This UI change is not a database-usage optimization or an authenticated production acceptance test.
- Deployment requires approval and separate production health verification. This document records pre-deployment validation, not live production acceptance.
