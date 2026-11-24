# One scheduling workspace

## Review findings and fixes

The everyday Schedule page previously returned a second full application when opening detailed tools. That application had its own Stickney Scheduler title, Admin/My Schedule switch, task groups, navigation and calendar. The two clients used the same authenticated API, but their layout and navigation made them look like separate builds.

- Keep the Schedule header, My schedule/Manage switch, refresh control and task navigation visible while using detailed tools. Remove the second application shell only when embedded; standalone fixtures and existing components remain supported.
- Use the fuller department calendar in this workspace, retaining time filters, automatic time cycling, saved day details, dated staffing changes, new shift/day positions, and existing validations. The personal member calendar remains personal.
- Carry the selected month between setup, availability and department calendar. Return to staffing from the same navigation and reload saved data after tool changes.
- Keep shift-pattern editing, new shift types, recurring crews, people/qualifications, approvals, availability, conflicts/rules, reminder/deadline settings, required confirmation, open-position search, member preview and member workflows available. On phones, one labeled tool selector replaces the crowded administrator tabs.
- Preserve unsaved new-shift and recurring-assignment drafts with a leave warning. Cancel keeps the draft. Guard duplicate tool saves, block writes after an unsuccessful refresh, and allow retry after an unsuccessful save without claiming success.
- Match embedded surfaces and controls to the surrounding Stickney workspace. Fix narrow-screen tab overlap and the dark-mode setup-note contrast.

No API handler, scheduling algorithm, schema, permission, notification delivery setting or dependency changed. Recurring crews and filled assignments remain protected by the existing administrator API. Other automatic assignments require saved availability covering the entire shift plus qualification, time-off, overlap and priority checks. Blank days grant no consent.

## Verification and boundaries

Scheduling screen/control inventory:

| Area | Controls retained | Coverage for this change |
| --- | --- | --- |
| My shifts | Upcoming shifts, list/calendar, whole crew, trade, new request, show more | Existing focused tests; isolated Requests navigation |
| Coverage | Trade/open filters, role/date filters, claim and trade dialogs, show more | Existing focused tests; component preserved |
| Personal requests | Active/all, new request, availability/time-off requests, saved status | Isolated personal navigation; existing focused tests |
| Staffing | Date/previous/next/today, shared calendar, positions, special details, assignment dialogs | Responsive checks; existing isolated save/model tests; no live save |
| Department calendar | Month/day/today, previous/next month, time filters/cycling, day details, dated positions, assignments and time edits | Isolated shared-calendar/save-result and date-context journey; live December read-only |
| Monthly setup | Month, recurring crews, patterns, availability, fill review, saved calendar, rules | Isolated journey and 6 final setup/navigation tests; live December read-only |
| Availability | Member, month navigation, day selection, available/unavailable and time fields, save/remove | Responsive checks and existing focused tests; live December read-only |
| Shift patterns | Existing pattern, edit/new pattern dialogs, recurrence and required positions | Responsive/source review; no live mutation |
| Recurring crews | Saved list/remove, add member/shift/position, member search and preferences | Responsive/read-only preview checks, draft warning source review; live saved list |
| Add shift patterns | Name, times, rotation preset, first day, recurrence, color, positions, retire/save | Responsive checks; unsaved draft Cancel observed; no live mutation |
| People | Search and recorded eligibility/profile links | Responsive checks; existing permissions retained |
| Approvals | Requests/trades, status filters, review dialogs and decisions | Responsive checks; existing focused tests; no live decisions |
| Fill open positions | Date range, review, explicit assign, retry/back, result and calendar | Isolated failed-save/retry/persistence journey; unchanged consent/atomic-write tests |
| Find open positions | Dates, role/shift filters, reset, show more and open staffing day | Responsive checks and existing focused tests |
| Alerts/reminders | Existing rule edit/save, timings, push state, deadlines and delivery-health link | Alerts responsive checks; unchanged rule tests; no delivery settings changed |
| Conflicts/rules and required confirmation | Existing dedicated tools and authenticated controls | Entry points retained; no new claim of live mutation/delivery verification |
| Member preview | Open read-only calendar, disabled result controls, return to editing | Isolated browser verified |

Story: enter Schedule → navigate shared tools → review saved availability → explicitly fill future open positions through the existing authenticated API → see server-confirmed counts → review the shared calendar.

- Source review: owning workspace, embedded scheduler, navigation, calendar and setup components; unchanged `runAutoDistribution` handler and consent/atomic-save guards. Existing department/session permission checks remain server-side.
- 122 focused scheduling and session/security tests passed. Final navigation/setup subset and TypeScript checked separately. Changed-file ESLint has zero errors and one existing unused `OvertimeScreen` warning.
- Isolated browser: review made no operational requests. First fictional fill failed with no success card and retained its reviewed range; retry saved one eligible assignment and left two openings. The result opened the shared department calendar, with no second application branding. Member Requests still opened personal requests, and member layout preview remained read-only.
- Month journey: December setup opened December availability and calendar; returning from November calendar carried November back to setup.
- 72 layout combinations: 12 screens × 390/820/1388 widths × light/dark. One Schedule heading, no old scheduler brand, no root overflow. Visual review found and fixed tab overlap and the light setup note's dark-mode text. Final phone tabs are replaced by the tool selector; note text is `rgb(16,43,64)` on `rgb(229,238,247)`.
- Unsaved shift draft: leave warning observed; Escape/Cancel dismissed it and the entered draft remained. This required native dialog control because browser automation stalled on the confirmation.
- Isolated fixture requests are blocked from production. Required-confirmation, readiness and delivery integrations were not mutated to demonstrate this interface. This is not a new audit of every underlying backend action or physical-device behavior.

Local evidence: ignored `outputs/scheduler-unified-20261124/` contains test/build logs, layout measurements and screenshots. No real department test records or messages were created.

## Release outcomes

- Source: main workspace integration `f199157f1ca98c00e0111ffb5ed7d21320e35f30`; final contrast revision `ed71105c86669b926c90c306807fa4272dc04f84`. Both pushed to `codex/watchline-complete-20261123`.
- Tests: 122 focused tests passed; final navigation/setup subset 6/6 passed. TypeScript and local production build passed. Final CSS revisions also passed the production deployment build. ESLint: zero errors, one existing unused-component warning. `git diff --check` passed.
- Database migrations: none. No operational production-record writes and no notification settings changed.
- Deployment: `dpl_GPg62j86t7trMbNSJaVhiyShPnxJ`, READY, exact final source SHA, verified Stickney project `prj_RTtTvD39FwyEGUovkPg8wxrdJCtF`. Canonical production health returned `ed71105c8666` and `environment: production`; both canonical and legacy production aliases were present.
- Live browser: verified shared Schedule shell, no old Stickney Scheduler brand, saved recurring crews, December availability and department calendar. December totals remained 346 filled / 35 open / 33 members with availability. No live assignment action was run. Final calendar weekdays and setup kicker used dark text `rgb(20,44,69)` at 12px on the light surface. Final browser error log was empty.
- Read-only database verification: December active-position and standing-assignment fingerprints matched the established baseline. Both station reminder and schedule notification tables still had zero enabled automatic email/text rules.
- Live evidence: `outputs/scheduler-unified-20261124/live-unified-schedule.jpg`. Browser access was briefly unavailable during final checks, then recovered; final release checks and screenshot were completed afterward.
