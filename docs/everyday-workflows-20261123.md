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

- Source and push: `35004d656eb13c02ae5faaba4390cdb6970a8123` on `codex/watchline-complete-20261123`; remote SHA matched.
- Database migrations: none.
- Production deployment: `dpl_Faa31Yqw4LuTN5cipyMwr511rh5z`, READY at that exact application SHA. Both canonical and legacy production aliases assigned. Canonical `/api/health` returned `35004d656eb1`, production, Stickney Fire Department.
- Live read-only verification: all six Today task buttons displayed. Open shift log reached the existing Daily Log with the three instructions; Check my hours reached the read-only personal timesheet and its guidance; Check a vehicle reached the existing inventory workspace, three instructions and Pick your vehicle. No check was started and no production form was edited for verification. Screenshot: `outputs/everyday-workflows-20261123/live-today.jpg`.
- This final outcome update is documentation only; the deployed application remains at the SHA above.

Local screenshots, measurements and raw logs are in ignored `outputs/everyday-workflows-20261123/`.
