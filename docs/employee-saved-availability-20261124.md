# Employee saved availability — November 24, 2026

## Source changes

Employees' Requests screen now uses the same compact saved-availability list as administration. It defaults to a month, provides a direct month picker, date/note search, entry-type and custom-range filters, and shows 10 rows per page instead of continually appending dates. Notes expand individually; existing Edit and Remove controls remain.

The employee wrapper supplies only rows matching the verified viewer's employee ID. The shared list does not fetch data or choose another employee. Existing server authorization and save/delete actions are unchanged. The API's existing 45-day lookback remains explicit; older records remain saved outside the loaded window.

Editing opens the existing populated dialog. A confirmed single-date save selects that date's month and searches its date, so changing a note cannot hide the saved result behind the old note search. A month change clears the old search and returns to page one. Failed saves preserve the draft and do not reset the list as if saving succeeded. Multiple-date saves show their first month without narrowing to one date.

No recurring-crew, assignment, eligibility, notification, API-handler, dependency or schema changes.

## Verification

- 111 focused scheduling/availability/navigation/contrast tests passed.
- TypeScript, production build and changed-file ESLint passed with zero errors/warnings; `git diff --check` passed.
- Isolated non-admin fixture with 78 fictional entries: current month showed 30 matches with 10 rows, December showed 31, Next showed 11–20, a unique note search found its January date, and Edit restored the original values.
- First save was deliberately rejected; the draft remained. Retry saved the same entry. The saved-date destination showed the January entry and revised full note. Choosing December then cleared the old exact-date search and showed 31 matches again.
- The fixture included another employee's availability; only the viewer's 78 entries appeared and no Manage control was available. The administrator's existing compact list also still rendered 10 rows.
- Phone/tablet/desktop widths 390/820/1388 in light/dark mode: no measured text contrast failures or document horizontal overflow. Invalid-range feedback passed light/dark checks.
- Local evidence: ignored `outputs/employee-availability-20261124/` directory. Fixtures are isolated and do not demonstrate production writes. Physical-device behavior and a separate live non-admin login are not certified by these checks.

## Release outcomes

Source push, production deployment/revision, live read-only checks and record/notification fingerprint comparisons will be recorded separately after release. No database migration is needed. Automatic texts and emails remain off.
