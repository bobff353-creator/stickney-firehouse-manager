# Three-pass app review — September 18, 2026

## Scope and safeguards

Reviewed the production-linked source at `D:\stickney-scheduler-member-release`, branch `codex/scheduler-member-release`, remote `bobff353-creator/stickney-firehouse-manager`, Vercel project `prj_RTtTvD39FwyEGUovkPg8wxrdJCtF`. Read the README, existing usability audit, member walkthrough and fixture guidance. No applicable AGENTS.md was present.

The app supports department members, officers, delegated administrators and payroll managers. Priorities were payroll accuracy, Daily Log saving, permission boundaries and the station board. Existing branding, features, data structure and pay rules were retained. No dependencies, database migrations, production records, credentials or hosting settings were changed. This work is local, not a production deployment.

Passes were performed in order: engineering, rendered design review, then testing and regression repair. Next.js, Supabase and React guidance informed validation, transactional writes, permission enforcement and reactive UI status.

## Pass 1 — software engineering

- Payroll rate requests now validate the entire submitted batch before writing. Settings, rate history, active rates and audit revision commit in one transaction. A bad later rate or database failure no longer leaves an earlier rate/settings change saved.
- Future-only rate history preserves current rates instead of replacing them with null.
- Invalid/missing payroll mutation periods are rejected instead of silently falling back to another period. Invalid calendar dates are rejected.
- Daily Log saves require the complete staffing/calls/notes document and a supported action. Malformed requests cannot be interpreted as empty lists and erase linked records/payroll. Incomplete user edits remain supported; the document itself must be well formed.
- Payroll time parsing rejects partial or extra time fragments. After-midnight overnight tours retain their correct duration for overlap review, including a 24-hour identical-in/out tour. Existing AO stipend, multipliers and rounding behavior were preserved.
- Out-of-order payroll loads no longer replace a newer response with an older one.
- Removing an employee account now requires permission-management authority, matching existing protection of rank/login identity changes. Both client and server enforce this gate.
- Reviewed proxy authentication, department membership, active employee resolution, explicit permission denials and server-side enforcement. A targeted pattern scan of 827 tracked text files found no matching token/private-key patterns; only `.env.example` was tracked. This is not a guarantee that production credentials or old Git history contain no secrets.

## Pass 2 — rendered design and usability

- Corrected dark-theme contrast on payroll headings, navigation/context text, signed-in identity, effective-date guidance and rate column labels.
- Corrected Daily Log note-composer, section description, equipment issue and handoff text contrast on mixed light/dark surfaces.
- Rates & Rules now shows unsaved/saving/saved/failed status, retains failed edits, offers Retry, blocks duplicate saves and disables controls during a save. Unsaved edits participate in the existing navigation warning.
- Mobile/tablet payroll inputs have readable text and touch-friendly heights. Testing found that desktop cell heights clipped the responsive form; mobile cells now grow to contain labels, inputs and error messages.
- TV staffing/call status text is larger. Delayed data has an amber indicator. Until the first successful response, the board says staffing/calls are **not confirmed**, rather than claiming no calls, no equipment issues, or no signed-in officer.
- Removed the inaccurate blanket promise that changing effective-dated rates could never affect earlier/closed payroll calculations. No historical-payroll policy was silently changed.

## Pass 3 — verification

### Automated checks

- Full suite: 949 tests passed, zero failures.
- Focused post-fix recheck: 59 tests passed, zero failures.
- Production build and TypeScript check passed.
- Scoped ESLint on the changed production TypeScript/React files passed with no warnings/errors. An existing ref-read-during-render issue in timesheet save status was fixed using reactive state; an unused board import was removed.
- `git diff --check` passed.
- New SQL tests use the actual route handlers and isolated PGlite database with the existing transaction adapter. They verify complete rollback, invalid dates/rates, future rates, stale writes, permission denials and finalized-period protections. They do not connect to production Supabase.

### Browser checks

Used the real React components and styles through the existing localhost audit harness. All records were clearly labeled fictional; mutations were intercepted and persisted only within the test tab. Browser tests are not proof of production database delivery; route/SQL tests provide separate persistence evidence.

- Phone at 390×844: rate entry, $24 base deriving $36 premium rates, forced save failure retaining the draft, Retry, saved confirmation and reload persistence.
- Daily Log: free-form note plus timestamped equipment issue, autosave, reload readback, resolving the issue, readable notes/handoff area. A fixture mismatch initially rejected ordinary saves; the harness was corrected to match the real route's default `save` action. The rejected draft remained visible and later saved successfully.
- Tablet at 768×1024: enter six shift hours at $20 = $120; forced failure on six AO hours restores the saved value and exposes Retry; retry produces $126 total without adding AO hours to paid-hours count. Review, explicit finalization and refresh retain totals and leave zero editable hour inputs.
- Small phone at 320×740: finalized timesheet fits horizontally; measured input bottoms stay within their parent cells after the overlap fix.
- Member view: own timesheet is read-only with no employee selector; a direct Rates & Rules URL redirects to permitted Home. Route tests separately exercise unauthorized writes and delegated permission boundaries.
- Desktop/TV at 1368×768: rate form contrast and layout; board loading, successful empty snapshot, and unavailable-service states. No false “No open calls” while unavailable, no visible TV management controls, no horizontal overflow; critical status text measured at 14px.
- Failed initial Daily Log/payroll load exposes Retry and does not render editable log controls.

### Limits and decisions

- Finalized payroll currently locks hour edits, but payroll calculation still depends on effective-dated rates and global payroll settings. Decide whether finalization must freeze an immutable rate/settings snapshot and how authorized corrections should work. That requires a deliberate historical-data/workflow change; it was not implemented implicitly.
- The browser's native unsaved-changes confirmation stalled one isolated test tab and was not verified end-to-end. The guard is connected and source-regression checked. Ordinary navigation after confirmed saves worked.
- The Vite fixture emitted a createRoot warning after hot replacement; this was a preview/hot-reload warning, not a production build failure.
- No live payroll was finalized, no real log was signed off, and no apparatus was marked inspected. Physical phone camera/VIN/push hardware, live CAD delivery, production RLS/session behavior and production end-to-end persistence were not exercised in this review.
- An actual department member still needs to perform the five-task phone/station walkthrough in `docs/usability-member-walkthrough.md`. This review does not claim exhaustive coverage of every app feature or certify payroll policy/accounting compliance.
