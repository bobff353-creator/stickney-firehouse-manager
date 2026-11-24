# Easier monthly schedule setup

The administrator can start at Schedule → Manage → Set up a month, choose a month, review existing recurring crews and patterns, inspect submitted availability, explicitly review and fill open positions, and review the saved calendar. Opening the guide and reviewing each step do not change records.

## Changes and preserved boundaries

- A five-step monthly starting page shows last-loaded saved counts and clearly identifies months with no built positions. Counts are navigation context, never proof that someone is eligible for a shift.
- Existing recurring crews appear first on Roster & Assignments. Adding another recurring assignment is optional and collapsed. Member qualifications, preferences and all original standing-assignment controls remain available.
- The selected month carries to availability, fill-date defaults and calendar review. Date-range editing remains available.
- Filling positions now requires an explicit review step. The existing administrator-only `runAutoDistribution` API continues to verify full saved availability, qualifications, time off, actual-time conflicts, role order, hours balance, rank and seniority. It updates only future open positions and preserves all filled assignments. No server rules were weakened or replaced.
- Successful responses show saved assignment/open-position counts inline with a next step. Failed saves retain the reviewed dates and do not show a new success result. Empty ranges cannot be run from the screen.
- No new notification settings or sending actions. Automatic email/text flags previously turned off remain off. No data migration, dependency, schema, API handler, permission or credential changes.

## Verification story

**Checking:** administrator chooses month → reviews existing records → confirms dates → existing authenticated API applies existing rules → response counts → saved calendar.

**Evidence:** the isolated fictional browser workflow made zero assignment requests during review; its first save failed and showed no saved-result card; retry returned one saved assignment and one open position. The calendar retained its recurring crew, added only the member whose entered hours covered the morning, and left the afternoon open. Switching to an empty December selected December availability and fill boundaries without making a write. A member-only fixture did not expose the new administrator shortcut.

Production verification was read-only; no real assignments were changed to demonstrate this UI release.

- 54 unique browser layout combinations across nine contexts at 390, 820 and 1388 widths with light/dark preferences: no root overflow or caught rendering errors. The final reordered roster was rechecked at all six settings.
- New guidance contrast: minimum 6.22:1 in both themes after fixing the dark-mode note. New guidance/review buttons measured at least 48 px high.
- Focused scheduling and new monthly-setup tests: 54 passed, zero failed.
- TypeScript passed. Changed-file ESLint has zero errors and the existing unused `OvertimeScreen` warning; the historical tool was retained.
- Full suite: **1,780 passed, zero failed**, with no skipped/cancelled/todo tests. Final production build passed after the last UI refinements. The final monthly-setup/workspace subset also passed 10/10.
- Physical phone/tablet testing is not established by viewport fixtures.

## Release outcomes

- Source/application revision: `2ab5d353ed34380ce812baa5cfa5635af065bbaa`.
- Push: application revision pushed to `codex/watchline-complete-20261123`.
- Database migrations: none. Production operational-record writes for this UI release: none.
- Production deployment: `dpl_EPWCRKzhBCQf7syFLihKxeKBYmM9`, READY, confirmed project `prj_RTtTvD39FwyEGUovkPg8wxrdJCtF` (Stickney Firehouse Manager).
- Canonical production `/api/health` returned application `stickney-firehouse-manager`, revision `2ab5d353ed34`, environment `production`. The legacy hostname's unauthenticated health request returned HTML rather than JSON; its authenticated application UI was verified separately.
- Live authenticated browser: Manage shortcut opened the guide; December showed 346 filled positions, 35 open positions and 33 members with availability. Recurring crews, December availability, review dates and December calendar opened correctly. The review screen explicitly required a separate assignment action; that action was not run in production.
- Read-only database fingerprints after UI verification matched the pre-release December assignments and all standing-assignment definitions. Both station reminder and schedule notification tables had zero enabled automatic email/text rules.
- Live screenshot: `outputs/schedule-setup-20261124/live-december-setup.jpg`.

Ignored local evidence: `outputs/schedule-setup-20261124/`.
