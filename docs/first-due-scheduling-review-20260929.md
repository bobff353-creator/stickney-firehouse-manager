# Scheduling review — September 29, 2026

Reference: [First Due Scheduling & Personnel](https://www.firstdue.com/products/canada/schedulingpersonnel), including Shift Management, Employee Center, Call Shifts, Time-offs, Trades, Personnel, Tools, and Reporting. Also reviewed the [US product page](https://www.firstdue.com/products/schedulingpersonnel). This is a review of public feature descriptions and illustrations, not a hands-on evaluation of their authenticated application.

## Findings and changes

| Area | Useful idea from First Due | Stickney result |
| --- | --- | --- |
| Shift management | Make staffing counts and vacancies easy to scan. | Added a seven-day staffing overview with previous/next navigation and direct day editing. Required seats and extra coverage are separate; no loaded schedule is explicitly identified. |
| Employee center | Put everyday member actions together. | Added direct availability, request-status, and incoming trade links beside My shifts. Existing personal assignments and open-shift requests remain. |
| Call shifts | Make the opening and next action clear. | Open positions now filter by date range, position, and shift, with today/7-day/14-day shortcuts, required/extra labels, and existing award-deadline indicators. Filters survive opening and returning from a day within the workspace. |
| Time off | Distinguish requests from approved changes. | Preserve the department's current part-time workflow and unavailable-time entry. No new leave entitlement or accrual policy was assumed. |
| Trades | Separate offers waiting on a member from accepted trades ready for review. | Existing split and approval protection retained; member home now gives a direct path to incoming offers. |
| Personnel | Keep qualifications and recurring staffing easy to find. | Added guided setup links to the existing roster and standing assignments. Employee qualification rules remain authoritative. |
| Tools | Guide setup, automation, and notification configuration. | Added a five-step setup guide: shifts, roster, availability, distribution, reminders. No additional polling or database queries. |
| Reporting | Connect staffing to trustworthy records. | Existing payroll and timesheets preserved. No new payroll calculation or automatic compliance claim introduced. |

## Intentional limits

- Counts summarize saved, loaded seats; they do not certify operational coverage, qualifications, or future dates that have not been built.
- Selecting a staffing card opens the day's editor. Assignment validation and explicit saves remain on the existing server-backed workflow.
- Notification configuration is separate from proof of delivery. This review does not send notifications or assign real members.
- Drag-and-drop assignments, leave accrual banks, vacation bidding, and owed-trade-hour ledgers would need their own department rules and end-to-end implementation. They are not represented as shipped here.
- The public pages do not establish comparative reliability, security, legal compliance, or actual user-test completion time. The design aims to reduce the number of choices and make the next step visible.

## Validation

Pure calculation tests cover required versus extra seats, missing schedules, inconsistent member/status records, deduplication, date/role/shift filtering, month/year boundaries, leap years, and daylight-saving dates. Browser checks use fictional fixtures before read-only production verification. No operational scheduling records are changed for acceptance testing.

Completed before publication: 15 targeted tests passed; production build and TypeScript passed; targeted lint had no errors (the pre-existing unused OvertimeScreen warning remains). Fictional browser checks passed at 390px and 1200px: no horizontal overflow, week navigation, combined date/position filters, direct day editing, preserved filters on return, setup guide, availability shortcut, and request-status shortcut. No browser console errors were observed during those checks.

The first live check exposed a usability issue: 1,965 open seats spanned all loaded future dates, while only 9 fell within the next seven days. The starting count and filter now focus on those next seven days. Clearing filters still exposes all loaded future dates, with 50 results rendered initially and an explicit Show more button to avoid a large initial list.
