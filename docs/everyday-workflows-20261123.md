# Everyday workflows — November 23, 2026

Everyday screens now show a short answer to three questions: **Start here**, **How to save**, and **What's next**. The wording uses familiar words and the real controls already present in the app. This is navigation and save guidance; it does not replace required checks, validation, review or approval.

## Changes

- Today starts with “What do you need to do?” and six permitted task choices: Open shift log, Check a vehicle, Open a call, See station duties, See my schedule, and Check my hours. Each opens its existing tool. Choices remain filtered by the signed-in user's access.
- Visible three-part guidance covers 18 everyday portal screens: Daily Log, Scheduling, Daily Duties, My Timesheet, Timesheets, Payroll, Work Details, Training, Field Preplans, Safety Inspections, Fire Inspections, NERIS Reporting, EMS, Policies, Box Cards, Employee Contacts, Phone Numbers and Employees.
- Vehicle selection, active checks, equipment, repairs, air equipment and saved reports have guidance matched to their current workspace (eight view contexts). “Pick your rig” and “Change rig” now say “Pick your vehicle” and “Change vehicle.”
- Dedicated record forms keep their own step controls instead of showing a second generic guide. Response, Command Board and Live Operations retain their focused layouts.
- Save feedback says **Save not confirmed** when confirmation fails. It retains the caller's specific recovery instructions and real retry action. Without a specific detail, short instructions explain waiting, saving or retrying. A confirmed time is still shown only for the Saved state.
- Saved work remains distinct from submission, officer approval, payroll finalization, publication and sending a message.
- Phone layout checks corrected a narrow guide column and a squeezed refresh/status area. Guidance uses 14px body text, high contrast, full-width phone rows, and three columns where space permits.

## Preservation

No operational API, schema, saved IDs, records, files, approval rule, permission rule or notification configuration changed. Existing feature navigation, All tools, Help, admin tools, history, recovery and original form controls remain. Automatic email/text delivery stays off. No purchase or real operational test write was performed.

## Verification

- 162 layout combinations: 18 guided portal screens, Today, and eight inventory contexts, each at 390/820/1388 widths in light/dark preferences. No root overflow or caught render error in the final checks. Guidance text contrast was at least 8.08:1 in these fixtures.
- Actual fictional check journey: choose vehicle → start its air check → display active-check guidance. This created only a local fixture check.
- Actual fictional timesheet journey: enter hours → simulate failed save → see Save not confirmed and the entry's retry → retry → see Saved → reopen and confirm the same saved hours. No production payroll records were used.
- Print check: guidance hidden and all 15 dated timesheet rows retained.
- Five new tests cover the three visible steps, dedicated-form behavior, read-only/submission/delivery boundaries, honest save status and its retry callback, and permission-filtered Today navigation without writes. Existing vehicle-picker assertions were updated to the new words while retaining their behavior checks.
- TypeScript and changed-file ESLint: passed.
- Full suite: **1,777 passed, 0 failed**, none skipped/cancelled/todo. Production build passed, including the final wording. The five guidance tests also passed after the last wording review.
- Physical-device testing is separate from these browser/fixture checks.

## Release

- Source changes reviewed and committed for release; exact pushed SHA is recorded after deployment below.
- Database migrations: none.
- Production deployment and health revision: pending.
- Live read-only verification: pending release.

Local screenshots, measurements and raw logs are in ignored `outputs/everyday-workflows-20261123/`.
