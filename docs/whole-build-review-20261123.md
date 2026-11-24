# Firehouse Manager whole-build review — November 23, 2026

The review covers the registered portal, the separate apparatus workspace, owning UI/server paths, and isolated record-changing workflows. Final regression passed. Push, deployment and live release checks are recorded separately below.

## Findings and fixes

| End-user problem | Result |
| --- | --- |
| Command Board had a large empty status area and an almost invisible building | Already published at `d89ee71a0931a579244e98fe31b6c1220f62052d`. Compact status, independently sized tactical grid, responsive panels, retained warnings/recovery/print. |
| Equipment directory rendered over 1,600 asset buttons immediately | Initial group of 50, explicit matching/visible totals and Show next controls. Search still includes every matching asset, and selected-record links remain independent of the visible group. Reused the apparatus index during rendering. |
| Rates & Rules listed assigned employees without an edit path | Every scale has an expandable assignment list with links into the filtered employee roster and the existing Employment/pay-scale editor. Other employees can be selected from that roster. Existing permission checks and explicit employee save remain; no silent reassignment or new bulk-write API. |
| Correction notes could be discarded by period navigation | Shared dirty/saving navigation protection covers request and resolution drafts. Both pay-period arrows check it before changing periods. Cancel can retain the draft. |
| Initial correction loading looked like a failed request | Explicit loading state, abort on unmount, clear refresh/retry controls. |
| A confirmed correction save followed by a failed refresh looked like a failed save | Save confirmation is separate from list refresh. Stale lists are labeled; an old zero count and stale resolution actions are suppressed. |
| Retrying a correction with altered details could silently accept the earlier content | Server rereads the saved request/resolution, confirms matching actor/content, and returns a conflict for different details. Original revisions are retained. Matching retries do not duplicate records or alter hours. |
| Saved open calls and fresh application polling could be mistaken for verified fresh CAD | Today and Live Operations explicitly label saved open calls and state that upstream CAD delivery is not independently verified. Response retains incident receipt time. Unknown call data is not reported as zero. |
| Live Operations said coverage needed attention even with enough crew | Distinguishes missing officer sign-in from missing crew coverage. It does not mark the shift ready on headcount alone. |
| Readiness could show reassuring zeros while its source was loading/unavailable | Apparatus status and integration updates remain unverified until a successful source response. Last received records stay available with a warning. |
| Two older routes could reach primary-department services from an isolated department | Account-linking and Aladtec routes reject isolated department portals before privileged/global service access. Schedule viewing also requires an existing authorized permission. Missing scope/access fails closed. |
| Selected map records could retain an old location after refreshed coordinates | Selected coordinates are explicit effect dependencies; unrelated item refreshes do not repeatedly recenter the map. Footprint lookup tracks its complete view object. |
| Menu focus restoration read a mutable ref during cleanup | Captures the original trigger for reliable focus return. |
| Repository lint and test fixtures had drifted | Removed 21 lint errors without blanket rule disabling. Updated missing fixture modules, scheduler wrapper expectations, and trust/focus/call-label assertions to exercise current behavior. Typed the fictional air-equipment fixture and renamed misleading CommonJS local variables. |

## Live review coverage

All 37 registered portal entry points were visited with the verified existing session. Loading captures were followed by loaded-state checks for data-backed screens. Detailed read-only journeys included:

- Today priorities, apparatus service records, previous handoff and help; Command Center source/urgency filters and its exact asset source link.
- Live Operations pause/resume and manager tabs, without publishing settings or enabling sound; Command Board layout, recovery visibility and historical controls.
- Timeline event filters and empty-state recovery; task queue next-page, no-match search and restored search.
- Response CAD freshness notice, Street View fallback, Floor Plan and Footprint tabs with truthful missing-data states.
- Preplan list/search, selected building, full saved brief, and a missing Construction detail leading to the correct Building editor. Exited by preserving the local device draft; no department preplan save.
- Road-closure map styles/recenter/history; safety-inspection entry/filter controls; Fire Inspection overview, queue, property search/no-match recovery, checklists and reports.
- NERIS reports/desk/feature boundaries; training overview/history; schedule member calendar, coverage, requests and manager view.
- Payroll, work details, Daily Log, Timesheets, callback queue and personal timesheet controls. No hours, approvals, sign-ins, call fields or period statuses changed for testing.
- Employee roster, contact directory, policies and no-match recovery, box-card directory, holiday policy, EMS originals/deleted-document recovery area, duties, phone directory and rates.
- Department settings, System Health, rank/member permission views, Live Operations grant filtering, CAD settings, device modes and Test View. No grants, routing or device modes saved.
- Separate inventory directory, complete saved report (22 weekly results), air packs/bottles, maintenance, medications/stock, repairs, apparatus status, readiness, operational-check selection, inventory-count selection and setup. Compartment 1 → Tool Box filters showed linked contents; filters were restored afterward. No checks were started merely to test navigation.

The original EMS Patient Assessment remains present, and the deleted-documents area contains the previously removed duplicate. Nested container editing/checks, checklist/schedule filtering, and preplan editing improvements from earlier releases remain in the current source and are included in regression tests.

## Isolated and responsive verification

The actual portal components were rendered using a fictional API fixture at 390, 820 and 1,388 pixels, in light and dark preferences: **37 entry screens × 6 = 222 layout checks**, with no root horizontal overflow or caught render errors. Some fixture endpoints intentionally return unavailable/empty data; these checks establish layout/recovery rendering, not every populated workflow. Populated live screens and deeper fixtures supply separate evidence.

Expanded rank assignments and equipment-directory layouts also passed all six combinations. The apparatus navigation modal closed and returned keyboard focus to its original trigger. The assignment journey reached the filtered member, opened the existing editor, exposed the Rank / pay scale selector, and returned without saving. The equipment fixture showed 50 of 139 items, then 100; search found item 136 beyond the initial group. The selected equipment deep link remained available, with zero writes.

Correction workflow tests exercise initial failure/retry, dirty/saving guards, canceled discard, retained failed-save inputs, stable retry token, duplicate-submit prevention, confirmed save with failed list refresh, and aborted initial load. Server tests cover altered retries and competing resolutions. Isolated boundary tests cover other-department, denied, unavailable-scope and authorized primary-department cases. A readiness source failure showed Unverified rather than a false all-clear.

The full isolated suite uses stripped service credentials and a network-denial hook. It includes database-backed tenant, grant, stale-editor, rollback, immutable-history, file, import, scheduling/payroll, incident-command, NERIS, training, inspection, recovery, print/export and notification-safety tests. Passing those tests does not establish actual live message delivery or a physical restore.

## Source and control inventory

Initial inventory: 941 tracked source/style/SQL files (97,149 lines), 155 API routes, 3,279 control definitions and 316 test files. Control templates are counted once rather than once for every rendered employee or equipment record. Release inventory: 941 source/style/SQL files, 97,206 lines, 3,283 control definitions and 318 test files. See [the coverage appendix](whole-build-coverage-20261123.md) for all registered screens, API/test references and 158 UI/control-owning files.

TypeScript/build and repository-wide ESLint cover the included source. The route inventory cross-references exported methods, access helpers and test references; permission/session/origin/department boundaries and the owning workflow paths were reviewed, with the two legacy-route issues fixed above. A text match to a test or access helper is an audit aid, not proof by itself. This report does not claim a manual click of every repeated record button or a manual line-by-line proof of the entire repository.

## Access-dependent observations

- **Backup monitoring:** live System Health says Supabase denied the monitoring request. The existing scoped token needs its expiry/project/Backups: Read access checked. No current backup success or recoverable restore is claimed. No credential was replaced or access widened during this review.
- **Dispatch:** the application receives saved incident data; independent upstream CAD connection freshness remains unverified and visible.
- **Physical devices:** camera/barcode capture on the actual department devices, airplane-mode close/reopen, and actual push delivery require device testing. Local/browser tests do not establish those outcomes.
- Automatic email/SMS remain off. No notification test, purchase, unrelated project cleanup, or Catnap change was performed.

## Release outcomes

- Source changes: prepared and reviewed as listed above; preserve department records, IDs, saved check history and private originals.
- TypeScript / production build: final production build passed; standalone type-check result recorded separately in verification outputs.
- Tests: **1,772 passed; 0 failed**, no skipped/cancelled/todo tests. `npm test` includes the successful production build and stripped-credential/network-denied isolated run.
- ESLint / whitespace: repository-wide app/scripts/tests ESLint has **0 errors and 51 warnings**. Remaining warnings include image optimization, unused declarations and the intentional camera generation-ref cleanup pattern; they are not being represented as a warning-free run. `git diff --check` passed; no blanket suppression introduced.
- Pushed commit: pending final checks.
- Database migrations: none.
- Production deployment and canonical health revision: pending final checks and committed release.
- Live release verification: pending deployment; earlier read-only observations describe the previous production release.

Private screenshots/control catalogs and raw logs stay in ignored `outputs/full-build-review-20261123/`. Public review documentation contains no credentials or private operational/HR contents.

Documentation consulted for the security/release review: [Supabase SSR guidance](https://supabase.com/docs/guides/auth/server-side/creating-a-client?queryGroups=framework&framework=nextjs) and [Supabase changelog](https://supabase.com/changelog.md); local Vercel React and deployment skills supplied the corresponding review checklists.
