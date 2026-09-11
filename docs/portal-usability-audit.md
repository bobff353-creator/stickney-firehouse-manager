# Portal first-use usability pass

## Release state

This report records the local validation completed before deployment. The user subsequently approved pushing and deploying this version. Production release status is reported separately after deployment verification. Production records were not changed by the audit.

Verified source: `D:\stickney-scheduler-member-release`, branch `codex/scheduler-member-release`, based on `b9fe3c5e270663c6310f95d3d77e0ea578920489`. Remote: `bobff353-creator/stickney-firehouse-manager`. Linked Vercel project: `stickney-firehouse-manager`, `prj_RTtTvD39FwyEGUovkPg8wxrdJCtF`, team `fire-pre-plan-pro`. Intended live hostname: `stickney-firehouse-manager.vercel.app`. The ambient OneDrive directory is not the release checkout.

## Changes

- All 32 portal workspace keys have specific, short first-use instructions. A shared Home / previous-workspace path preserves the record context. The established auto-hiding menu remains intact.
- Home has common tasks and a searchable, permission-filtered task directory. Search opens the exact policy, box card, employee, or contact instead of only opening its parent screen. Footer support-looking dead controls were replaced with actual permitted destinations and an administrator-help instruction.
- Employee editing has an explicit Cancel / Back to roster path, unsaved-work protection, busy states, and an inline failed-save recovery. A returned employee ID is retained if the subsequent photo operation fails, preventing a retry from adding a second employee.
- Policy, box-card, and phone editors keep failed edits; Cancel only warns for changed drafts. A failed phone deletion no longer reports success. Read failures provide a retry and no longer look like an empty library. Read requests in the revised reference paths time out after 15 seconds instead of spinning indefinitely.
- Work Details, Callback Reviews, permissions, and the scheduler have clearer unavailable / retry states. Analytics do not fabricate zero totals after an initial read failure. Road Closures no longer says all roads are open when a load fails, or merely because there are no reported closures.
- Phone/tablet timesheets show a selected day with full category names, plus an explicit whole-period option. Every date remains in the document and the print styles restore the full table. Pay-period navigation is compact. Record metadata and revision history are expandable while record number, status, and Print remain visible.
- Responsive fixes cover employee / preplan grid sizing, department and analytics headers, Daily Log save status, Respond map controls, and reference reading panes. Dark-mode timesheet totals have explicit readable foreground/background colors.
- Staged Command Board units can be selected with a tap or keyboard, not only dragged. The staged controls wrap inside the narrow desktop column and their panel grows to avoid clipping its header.
- Failed sign-in, activation, PIN actions, and password-recovery requests have recovery messages instead of unhandled errors or permanently busy screens. Authentication, PIN verification, department membership, and permission rules remain unchanged. Duplicate in-flight account form actions are guarded.
- The admin portal preview allows safe navigation and record-detail inspection. Opening the separate inventory workspace from that preview requires explicitly exiting Test View; it does not silently become an administrator session in a supposed member preview. Inventory's existing saved member preview remains the correct apparatus preview.
- Fixed an empty upcoming-shift rotation crash and a Node test import-resolution issue. Scheduling eligibility, payroll calculations, emergency-call polling intervals, dispatch processing, and database schema were not changed.

## Verification performed

These are **local fixture results**, not production integration evidence. The real React components run against clearly labeled fictional responses. External operational requests are blocked. No real sign-in, email, phone call, record edit, photo upload, dispatch, or checklist completion was performed.

| Coverage | Result / evidence |
| --- | --- |
| 31 portal screens at 360, 390, 768, 1024 landscape, and 1280 pixels | 155 baseline rendered states passed geometry and runtime-error assertions. Inventory is audited separately. |
| Unavailable API responses, 31 portal screens at 390 pixels | 31 states passed no-crash / no-page-overflow assertions; explicit error semantics were checked in revised modules. |
| Forward/back, exact document search, editor cancel protection, failed saves, delete retry, day/period selection, member-only paths | 20 phone/tablet workflow states passed. |
| Sign-in, invitation/recovery entry states, failed sign-in retry, new-user return, record-detail toggle, staged-unit tap | 42 light/dark phone, tablet, and desktop states passed. |
| Inventory crew and admin navigation, equipment lookup, builder sections, member preview | 54 phone/tablet states passed with the full root CSS cascade. No writes from navigation. |
| Inventory save failure, save/preview, saved-but-refresh-failed, recovery, member check, completed report | 12 phone/tablet fixture states passed. |
| Admin Test View opening inventory | Verified explanation + explicit exit path, preview retained, zero writes. |
| Automated regression suite | `node --test tests/*.test.mjs`: 528 passed, zero failed. Targeted navigation/auth tests also passed after refinements. |
| TypeScript and production build | `npx tsc --noEmit` and `npm run build` passed. |
| Targeted lint over changed components | No errors. Two existing warnings remain: revision-driven Command Board effect dependency and unused scheduler OvertimeScreen. |
| Accessibility spot checks | Shared wayfinding and task directory: zero axe WCAG 2 A/AA violations or incomplete findings. Sign-in contrast scan: zero confirmed violations, six nodes requiring manual review; not a full accessibility certification. |

The automated browser scripts record 314 rendered/workflow states in total, not 314 distinct features. Screenshots were visually reviewed, and the dark-mode contrast and staged-control clipping findings were fixed and rechecked. Baseline runs preceded some shared-component refinements; focused workflow reruns cover those refinements. Passing geometry alone is not proof that every nested production workflow works.

Evidence directories under `outputs/`: `portal-usability-phone-final`, `portal-usability-tablet-final`, `portal-usability-final` (1280px rows), `portal-usability-landscape`, `portal-usability-failed-reads`, `portal-flows`, `portal-entry`, `inventory-audit-portal-regression`, and `inventory-flows`. Each includes `results.json` and screenshots. `command-panel-final.png` shows the unclipped panel; `timesheets-compact-top.png` shows the shortened phone header.

## Reproduce

Start `node scripts/preview-portal-usability.mjs` (local port 4181). Set `PORTAL_AUDIT_BROWSER` to the installed agent-browser executable, then run:

```text
node scripts/audit-portal-usability.mjs
node scripts/audit-portal-flows.mjs
node scripts/audit-portal-entry.mjs
```

The baseline script accepts `PORTAL_AUDIT_WIDTHS`, `PORTAL_AUDIT_HEIGHT`, `PORTAL_AUDIT_ROLES`, `PORTAL_AUDIT_PAGES`, `PORTAL_AUDIT_FAILURE`, and `PORTAL_AUDIT_SUFFIX`. Do not run two copies sharing the same browser session concurrently. Inventory scripts use the existing isolated fixture server on 4179 and `INVENTORY_AUDIT_BROWSER`.

## Boundaries and remaining acceptance work

- This is a portal-wide usability pass, not a claim that every possible record, role, and nested workflow has been exhaustively accepted by a first-time user. A short real-member/admin walkthrough remains valuable.
- Physical iPhone/iPad/Safari, native date pickers, on-screen keyboards, camera/barcode hardware, installed PWA behavior, real PDF printing, push notifications, real call audio, and six concurrent operational screens were not re-tested in this pass. The native date value-change path was exercised programmatically.
- Invitation and password-recovery pages were rendered without live tokens. No authentication provider account changes were made. Provider guidance was checked against the [Supabase changelog](https://supabase.com/changelog) and [Auth documentation](https://supabase.com/docs/reference/javascript/auth-updateuser); existing verified-account requirements were retained.
- Live-map services, external informational feeds, photos, and server persistence were not accepted end to end with production records. Fixtures exercise save acknowledgments and failure recovery, not durable production writes. Tables/maps that inherently need horizontal scrolling remain contained within their own panes.
- The React, browser-verification, and Supabase guidance informed this pass: preserve client/server boundaries, inspect actual rendered controls and failure paths, and improve account recovery without weakening authorization.
- No provider, service plan, database schema, authentication policy, or call polling interval changed. No data-usage reduction claim is made for this UI work.
- Deployment has been approved for this verified project. Verify the production build and health separately from authenticated navigation and member/admin acceptance; do not represent fixture results as live operational acceptance.
