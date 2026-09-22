# Isolated scheduler UI verification

Run `node scripts/preview-member-scheduler.mjs` and open the printed local URL.
Use `scheduler-mobile.html` for 390px, `scheduler-small-phone.html` for 360px,
and `scheduler-preview.html` for desktop. All records are fictional.

The fixture intercepts the scheduler API in the browser. No production API or
database is contacted. Assignment changes affect memory only; the first save
deliberately fails. Reloading resets the fixture. Other administrative writes
are blocked. Do not use this fixture as proof of production persistence.

Verified interactions on September 9, 2026:

- Admin home opens the four common tasks; counts distinguish ready trades.
- The admin phone menu is one picker and changing tasks scrolls to the content.
- Day staffing is inline, with a date control and optional month view.
- Selecting a different employee sends zero writes and shows an unsaved state.
- First save fails, retaining the draft; retry succeeds and reloads the assignment.
- 360px and 390px daily staffing controls fit without horizontal overflow.
- Open positions link to the selected day.
- Requests show member, date, role, shift times and approval consequences.
- Accepted trades and waiting offers are separate; waiting offers cannot be approved.
- Member All scheduled shows other members without assignment edit controls.
- Desktop navigation omits the mobile picker.

This is viewport testing in a desktop browser, not testing on physical iOS or
Android hardware. Live assignment writes, notifications, and advanced bulk
distribution/roster settings were not exercised in the browser.

## Daily Log save verification

Run `node scripts/preview-daily-log-save.mjs` and open its printed local URL.
The real Daily Log component uses fictional, in-memory API responses here;
all other API requests are blocked. This is not proof of production persistence.

Verified September 20, 2026 in a desktop browser:

- Schedule-prefilled staffing explicitly waits for confirmation, not saving.
- A simulated 12-second save disables repeat confirmation and issues one POST.
- A missing response shows a slow-save warning, ends after 30 seconds, and
  offers Retry without discarding the draft.
- Switching the fixture to Success and retrying confirms the retained changes.
- No browser console errors were reported during these interactions.

`daily-log-save-reliability.test.mjs` exercises queued edits, offline operation,
response-body timeouts, missing receipts, conflicts and unavailable draft storage.
`portal-atomic-saves.test.mjs` executes the route, adapter and transaction migration
against isolated PostgreSQL, including rollback, finalized periods, payroll totals,
manual-entry preservation and a 205-call fixture. No live operational data is used.

Release recheck September 21, 2026:

- All 63 targeted Daily Log, department-schedule, payroll, and atomic-save tests passed.
- The production build and lint for every changed code/test file passed.
- In the local browser, edits made during a slow save were retained through a
  follow-up timeout; Retry confirmed the retained notes. Three expected requests
  were made, with no duplicate confirmations and no browser console errors.
- Full-project lint still reports pre-existing errors outside this Daily Log change.
- Tests use fictional records only; no live log, payroll, or handoff was changed.
