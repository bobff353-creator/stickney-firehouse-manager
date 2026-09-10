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
