# Stickney schedule workspace

The portal's Schedule page now opens the mobile scheduling workspace. It uses
the authenticated `/api/station-scheduler` endpoint and the existing department,
employee, clearance, slot, request, recurrence, and reminder records. There is
no import, seed, separate operational store, or database migration in this change.

Members have My shifts, Coverage, and Requests. They can offer their saved shift
to a qualified individual or the qualified crew, select an actual return shift
for a directed swap, accept an eligible offer, request an open position, save
availability, and request time off on their scheduled dates. Acceptance and
approval are separate. Server permission and eligibility checks remain authoritative.

Manage contains daily Staffing, Approvals, Recurring schedules, People, and
Alerts. Waiting trade offers are separate from requests ready for approval.
Special details add open one-day positions through the existing action. Employee
clearances link to the canonical Employees page. Standing assignments, advisory
review rules, distribution, crew availability, confirmations, and detailed
reminders remain accessible through the existing scheduler tools.

The fixed-size Stickney patch, navy, gold, paper, red, and dark palette follow the
existing portal. Lists are bounded with Show more controls. Saves retain form
selections after errors, block duplicate submissions, refresh from the server,
and prevent further writes when a saved change cannot be reloaded. Member
previews are read-only. No notification subscription or production alert rule
was enabled as part of verification.

The workspace paints its own paper background so its headings remain readable
inside the portal's permanently dark outer workspace as well as standalone tests.

## Validation before release

- Node 24 and `npm ci` with the committed lockfile.
- `npx tsc --noEmit` and `npm run build` passed.
- 111 scheduler, trade, reminder, distribution, and session-security tests passed.
- ESLint passed changed files with one existing unused `OvertimeScreen` warning
  in the retained scheduler. `git diff --check` passed.
- Isolated browser checks exercised directed swap payloads, offer acceptance,
  shift requests, save failure/retry, special-detail, recurrence, reminder, and
  availability forms. Fictional fixtures are confined to tests and send no
  production requests.
- Phone light/dark and tablet/desktop layouts were inspected. These checks do
  not establish physical-device notification delivery.

The pre-release live read showed 43 active employees, 20 shift groups, 3,805
positions, and 580 availability records. Local ignored verification artifacts
under `outputs/scheduler-integration/` hold per-collection SHA-256 fingerprints
for the before/after read-only comparison. Live release and revision verification
must be reported separately from the checks above.

The independent prototype and private import snapshots under `new-schedule-app/`
are excluded from Git, Vercel uploads, and the production TypeScript project.
