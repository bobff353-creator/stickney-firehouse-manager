# Scheduling contrast and saved availability — November 24, 2026

## Changes

- Unified embedded scheduling panels with the workspace light/dark palette. Fixed dark-on-dark labels, white-on-white recurring-crew names, faint placeholders, calendar hints, expanded day/availability panels, time buttons, confirmation settings, notes, and validation messages.
- Increased field and secondary-button boundary contrast. Disabled buttons use opaque readable colors, not opacity fading. Keyboard focus and selected-state outlines have contrasting light/dark colors. Shift badges retain their colors and readable labels; small shift text no longer fades.
- Saved availability defaults to the calendar month and shows **10 entries per page**. Filters support the current month, today onward, all dates in the list, a custom inclusive range, entry type, and date/note search. Counts distinguish the list total from matching and displayed rows.
- Long notes expand individually. Edit/Remove remain available for the same records under existing permissions. Edit focuses the populated editor, Cancel edits clears only the draft, and page navigation focuses the list heading.
- Narrow availability calendars keep readable day buttons in a contained, keyboard-focusable sideways scrolling region. Measured targets are about 83 by 64 CSS pixels, replacing narrow cells that stacked letters vertically. A visible instruction explains swiping; month navigation remains outside the scrolling region.
- The API's existing 45-day lookback is unchanged. The UI states the earliest date included; earlier records remain saved. “All dates in this list” does not claim to fetch archival records outside that existing response.

## Contrast coverage

Reviewed all 15 supported admin destinations: month setup, availability, staffing, detailed calendar, approvals, shift patterns, recurring crews, people, alerts, advanced shift builder, distribution, open-position filters, conflicts/rules/readiness, reminders/deadlines, and required confirmation.

Employee coverage includes list/calendar/whole-crew selections, coverage, requests/history, availability repeat forms, trade offer/review, shift details, and claim dialogs. Additional checks cover shared admin dialogs, expanded calendar-day/time/extra-position editors, confirmation preview, draft discard, failed saves, custom-range validation, and expanded notes.

- Final evidence covers more than 230 distinct screen/state/size/theme combinations, including normal, hover, keyboard-focus and disabled controls. All final measured text meets 4.5:1 (3:1 for large text); no document horizontal overflow was found in those combinations. The narrow availability calendar intentionally scrolls inside its own region.
- All admin destinations and employee main screens/repeat forms were measured at 390, 820 and 1388 CSS pixels in light and dark mode. Hover/focus states were forced only in the isolated browser fixture and cleared afterward. These are viewport simulations, not physical-device certification.
- The read-only DOM audit records text and button styles; numeric source tests cover primary/disabled/status palettes, field/focus boundaries, and all seven shift-color labels. Visual inspection supplements the measurements. Browser-native popup rendering, arbitrary custom colors, OS contrast modes and physical displays are not exhaustively certified.
- Intermediate failures are retained separately from the final verified evidence. Browser access interrupted the first review; the review resumed after access recovered.

Ignored local evidence directory: `outputs/scheduling-contrast-20261124/`. `verified-contrast-audit.json` contains the latest checked combination for each key; `browser-evidence.json` and `final-evidence.json` retain the working audit. No production writes were used for contrast testing.

## Saved-list verification

With 78 fictional entries, the default November view showed 30 matches with 10 rows on page one; all eight pages under “All dates” exposed all 78 entries. The last page held eight rows with Next disabled. Filtering legacy unavailable entries returned eight rows with no Edit action. Searching a unique note returned one row. Full notes remained accessible. A reversed range showed an error without misleading results.

Edit restored the original note and focused the editor; Cancel edits wrote nothing. An isolated save updated the selected entry, and an isolated removal reduced the total by one. Switching members kept their lists separate. Model tests additionally verify stable paging, unique IDs across pages, source immutability, filter combinations, invalid ranges and page clamping after deletion.

## Checks

- Focused scheduling/availability/navigation/contrast tests: **111 passed, zero failed**. An existing source assertion initially rejected quote formatting of the unchanged delete action; the source was restored to the expected format and the full focused selection passed.
- Final additional contrast/list/portal-palette checks: **7 passed**.
- Final phone-calendar/source regression selection: **24 passed**.
- TypeScript and final production build passed.
- ESLint on changed TypeScript/JavaScript: zero errors, one existing unused `OvertimeScreen` warning.
- `git diff --check` passed. No dependency or database migration changes.

## Release outcomes

The source push, production deployment, health revision, live read-only checks and record/notification verification will be recorded separately after release. Existing recurring crews, assignment rules, authorization, automatic email/text settings and saved department records are outside the changes.
