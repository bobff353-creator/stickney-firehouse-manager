# App-wide readability and responsive UI review

Local branch: `codex/app-readability-20261017`.
Base: approved callback trial `ca1d7ce2514437095e8ddbefe05d044a466281e6`, preserving correctness HEAD `335de0f41b27970b80d0b33a423ae227e9f1fe27`.
Implementation: `a6ae4c55207fc0da645059f0b3e472d15f3cf934`; paper-surface focus contrast: `3b356cff98f6294caa7cce83832f52eb035dbcc1`.

## What changed

A shared screen-only layer in `app/readability.css`, imported last by the root layout, improves supporting type, line spacing, long-name/notes wrapping, narrow headers, field sizing and visible keyboard focus. Dashboard, Daily Log and scheduling controls receive explicit matching rules. Dedicated inventory has its own small layer imported last in `app/inventory/layout.tsx`.

`TableViewport` preserves original tables, columns, rows and actions in contact lists, safety inspection history, CAD delivery history and saved payroll sources. It adds a named focusable scrolling region and navigation guidance. Existing phone cards and timesheet day/full-period comparisons remain available. No data is hidden to fit the screen. The component has no state, network calls or event interception.

The portal workspace gains only a `data-page` attribute. Layout/style changes do not alter permissions, API calls, calculations, approval rules, save handlers or department branding. No new guidance disclosure was added in this pass; the approved callback disclosure remains. Critical warnings, record flags and statuses stay visible. Print styles and native document contents retain their existing layouts.

The official [Impeccable website](https://impeccable.style/), [repository](https://github.com/pbakaus/impeccable), [focused improvement](https://impeccable.style/docs/improve-design/), [typeset](https://impeccable.style/docs/typeset/) and [adapt](https://impeccable.style/docs/adapt/) guidance informed the manual pass. No installer, external executable, dependency or global skill change was used.

## Route coverage checklist

All 36 portal views were checked at 320/390/768/1280 CSS pixels in light/dark system preferences. The existing portal itself uses dark work surfaces on many routes; this pass does not invent a separate theme.

| Area | Views reviewed | Treatment |
| --- | --- | --- |
| Dashboard and command | Dashboard, Command Center, Operations Board, Activity Timeline, Task Queue | Shared reading/control styles; report disclosures; specialized live-board geometry retained. |
| Field | Respond, Command Board, Field Preplans, Road Closures, Safety Inspections | Shared forms/history; targeted toolbar and full-screen controls; map/incident geometry and map markers retained. |
| Private pilots | Fire Inspections, NERIS Reporting, Training | Shared form typography, controls and paper-surface focus contrast; existing lists and unavailable/empty states. |
| Scheduling | Scheduling | Labels, inputs and touch controls; existing calendar, availability and trade workflows retained. |
| Payroll and logs | Payroll, Work Details, Daily Log, Timesheets, Callback Reviews, My Timesheet, Rates & Rules | Readable fields, wrapping, comparison tables and print controls; all calculations and workflows retained. |
| Personnel | Employees, Employee Contacts | Wrapping names/contact details, clear form/header spacing and keyboard table navigation; roster cards retained. |
| Documents and duties | Policies, Box Cards, Holiday Policy, EMS, Daily Duties | Readable guidance/actions and list/reader checks; document/PDF contents unchanged. |
| Administration | Phone Numbers, Departments, System Health, Permissions, CAD Integration, Respond Device Modes, Test View | Shared form/actions/focus; settings warnings and permission boundaries retained. |
| Dedicated operations | Inventory portal entry and `/inventory` home/check views | Dedicated typography/controls and wrapping; existing equipment/check workflow retained. |
| Account entry/recovery | Sign-in, reset password, invitation attention state | Field sizing, wrapping and paper-card focus; no real sign-ins, invitations or credentials. |

## Acceptance evidence

- `npm test`: production build and **1,427 tests pass**, zero failures, skips or cancellations. New regression renders the real table wrapper and verifies all 12 comparison values and the final-column action remain present and accessible.
- Final production build, TypeScript, changed-file lint and patch whitespace checks pass. Final CSS-only focus and toolbar adjustments also received browser checks and a fresh production build.
- **288 portal layout cases**, plus **59 targeted/readiness rechecks**. The effective merged matrix has no runtime errors, unfinished tool-opening placeholders or horizontal overflow greater than the 1 CSS-pixel rounding tolerance.
- **48 additional cases** cover dedicated inventory home/check, sign-in, reset/invitation attention and dashboard service-error states at the same widths/preferences. No runtime errors or page overflow.
- **36 phone touch-target sweeps**: no visible measured buttons, non-checkbox/radio/range inputs, selects or disclosures below 44 px height in the synthetic views. Map markers intentionally keep their existing geometry; the empty-map fixture does not measure populated marker hit areas.
- **8 held-response loading checks**: callback, Daily Log, Work Detail and safety inspection states at 320/1280 px remain visibly or accessibly unavailable while pending and release without overflow. Daily Log uses a labeled busy skeleton; Work Detail truthfully says records are not loaded.
- **6 interaction flows**: employee search/edit/failure-retention/retry; policy reader/list return; timesheet selected-day/full-period rows; permission filtering without writes; wide-table keyboard scrolling and last-column action; restricted member navigation. The prior callback keyboard approve/deny/reviewer/retry evidence remains in the callback trial.
- Paper-card keyboard focus was checked at 3 px in darker brand blue; operational dark surfaces retain a light-blue outline. Keyboard scrolling does not intercept native form controls.
- **16 native Library screenshots**: before/after dashboard, Daily Log, employees, payroll, safety inspections and permissions at 390 px; dashboard/payroll comparisons at 1280 px. All are synthetic and wait for the tool to finish opening.

## Explicit exceptions and tradeoffs

Full-project `npm run lint` still reports **19 inherited errors and 21 warnings**. The 19 errors reproduce on the unchanged callback baseline: one payroll-corrections effect rule, two old script/test `module` variable assignments, and 16 `any` types in an older inventory-air fixture. The changed-file run has zero errors and one inherited fixture-navigation warning. Those unrelated behaviors and fixtures were not rewritten to force a green lint result; the logs are included.

Larger type and controls can increase vertical scrolling. Wide-table guidance adds a short line; columns/actions remain available. Operational canvases receive focus/toolbar checks rather than a new layout. This is not proof of active-incident, populated-map-marker, native PDF-viewer, assistive-technology or live hosted integration behavior. Some synthetic service endpoints intentionally return unavailable states; no real services were called to fill those gaps.

No push, deploy, provisioning, hosted mutation, access change, migration or credential creation occurred. Deployment-trigger/staging-isolation blockers remain. The earlier repeated-hour schema migration is unchanged and is still a separate migration-first release prerequisite. Historical payroll reconciliation and production disaster-recovery verification remain separate workstreams.

## Reproduce locally

Use existing Node 24 dependencies. Start `node scripts/preview-app-readability.mjs`; open its localhost URL. With an existing browser runtime, run `READABILITY_PLAYWRIGHT=/opt/codex/runtimes/cua/lib/node_modules/playwright/index.mjs node scripts/verify-app-readability.mjs after 4191 --full`, then `scripts/verify-app-readability-interactions.mjs` with the same environment. Set `CHROMIUM_PATH` if needed. These scripts block external browser requests and use synthetic fixtures. They do not install a browser or packages.

The package contains the app-wide patch based on `ca1d7ce…` and a combined UI patch based on correctness HEAD `335de0f…`, plus the report, route evidence, test logs, screenshots and native Library identity manifest. Apply only in a review checkout; neither patch authorizes publication.
