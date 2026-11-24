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

Source/push, final build, deployment revision and live read-only verification are recorded after release. No database migration. Both automatic email/text rule counts were zero before release; compare read-only December slot and standing-assignment fingerprints afterward.
