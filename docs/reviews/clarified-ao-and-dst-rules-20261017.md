> Follow-up: repeated-hour endpoints now have explicit persisted occurrence selections. See [repeated-hour-selections-20261017.md](repeated-hour-selections-20261017.md). Counts and limitations below describe the earlier acceptance run.

# Clarified AO coverage and elapsed-time payroll rules

Bob's instruction on October 17, 2026 at 00:25:59 UTC resolves AO concurrency and
DST duration. He confirmed one acting officer at any given time, with consecutive
partial coverage by multiple members, and 11/13 payable hours across the spring/
fall clock changes. This instruction supersedes the earlier review's open AO
scope and clock-versus-elapsed DST questions. It does not supply new eligibility
or approval rules.

Branch: `codex/firehouse-correctness-20261017`.
Implementation/regression commit: `916ac69d162a1d496ab294cc7919d30344552ec3`.
Downstream review consistency: `6cad9afd0068c0c6fc59d0979345375c72a2b708`.
Verified deployed-source baseline remains
`f8466609294970261d74e717256675e367aff66b`; deployment and retained-manifest evidence
remain in `deployment-baseline-evidence.json`. Nothing was pushed or deployed.

## Behavior implemented

- AO intervals are half-open: start included, end excluded. A 06:00–08:00 member,
  an 08:00–11:00 member and an 11:00–12:00 member all retain their own 2/3/1 duty
  hours and corresponding AO allowance hours. The shift is not limited to one
  person. A real overlap, including duplicate overlapping rows for the same
  member, is rejected rather than creating duplicate pay.
- Exclusivity applies across the department's Daily Log staffing, regardless of
  shift label. Adjacent operational logs are checked too, including a prior
  overnight officer continuing past 06:00. Exact handoffs and cross-midnight
  handoffs remain allowed. Non-AO officers and scheduled Officer/AO seats are not
  arbitrarily treated as paid acting-officer appointments.
- Coverage and neighboring log versions are read together in one snapshot.
  Existing department-serialized batch transactions recheck those versions before
  writing staffing/payroll. A concurrent assignment, newly created neighboring
  log, or relevant approval invalidates the save rather than being overwritten.
  Officer handoff approval explicitly increments the current log version even
  when actor/timestamp fields would otherwise be unchanged within one second.
- Daily Log and new payroll-submission schedule estimates use elapsed instants in
  `America/Chicago`: ordinary 18:00–06:00 = 12 hours, March 7–8, 2026 = 11 hours,
  October 31–November 1, 2026 = 13 hours. A complete 06:00–06:00 tour across those
  changes is 23 or 25 elapsed hours. AO allowance uses each member's elapsed
  appointment hours; existing base rates, eligibility, DPW and premium formulas
  remain unchanged.
- Staffing before 06:00 belongs to the next calendar date of its operational log.
  End time at/before start means the next calendar day. Calendar-dated optional
  Work Detail time suggestions use the actual selected calendar date, including
  pre-06:00 starts; changing the date recalculates the suggestion. Explicitly
  approved manual totals and callback approval policies were not redefined.
- Holiday-window intersections use resolved instants in the date-aware path, so
  regular plus holiday hours still equal actual worked hours without stacking
  premiums. Timekeeping review flags differences without changing recorded pay.

## Historical safety and limitations

No migration, automatic backfill, finalized-period rewrite, approved export
rewrite, or immutable submission rewrite was introduced. Existing date-less
clock arithmetic remains available for the existing legacy bootstrap calculation;
current save/projection paths explicitly supply dates and use elapsed time.

A historical log with posted clock-hour pay differing from the elapsed result is
blocked from incidental conversion by a later log edit. The response requires
independent attendance/export reconciliation and an explicit correction review.
The guard preserves staffing and payroll; ordinary lock metadata can still follow
the existing locking workflow. Already-correct elapsed postings remain editable
under existing permissions and period/version guards. Finalized payroll still
rejects changes transactionally.

The current record format stores local HH:MM without a UTC offset or first/second
occurrence selector. An endpoint such as November 1, 2026 at 01:30 is therefore
ambiguous; March 8, 2026 at 02:30 never occurs. Those endpoints are rejected with
an explanatory error rather than guessed, including API calls with manually
entered Work Detail hours. Unambiguous endpoints spanning either transition work
normally. Entering a handoff within the repeated hour will require a future
explicit-offset/occurrence input and persistent record representation; this patch
does not pretend existing HH:MM records contain that information.

AO eligibility, who may authorize exceptions or corrections, and substantive
rank/DPW/single-role eligibility remain governed by existing controls. Bob did
not redefine those rules. Hours-only manual payroll adjustments do not establish
operational coverage intervals and were not reinterpreted as assignments.
Original attendance, AO/callback approvals, effective rates/eligibility/calendar
records and independently approved same-period payroll exports remain necessary
for independent reconciliation of historical employee pay.

## Changed files and acceptance

| Files | Purpose |
| --- | --- |
| `app/staffing-time.ts` | Chicago local-time resolution, operational intervals, elapsed duration and AO overlap validation. |
| `app/staffing-payroll-server.ts` | Department-scoped neighboring snapshot guards and historical-posting safety. |
| `app/api/logbook/route.ts` | Date-aware pay, AO guards in atomic save, versioned approvals, retained error drafts. |
| `app/payroll-hours.ts` | Actual duration and holiday-window classification with unchanged allowance/category math. |
| `app/payroll-submission.ts`, `app/payroll-timekeeping-review.ts`, `app/payroll-review.ts` | Elapsed future estimates and read-only discrepancy flags; ambiguous projections become blockers. |
| `app/work-details.tsx`, `app/api/work-details/route.ts` | Correct dated suggestions, visible invalid-time feedback, fail-closed optional timestamp validation. |
| `tests/ao-dst-payroll.test.mjs` | Independent expected hours/pay, handoffs, edits, duplicate/department overlap, adjacent dates, gaps/folds, transactional races and historical preservation. |
| `tests/portal-atomic-saves.test.mjs` | Real new guards included in the existing atomic/version/finalization suite. |
| `tests/fixtures/work-detail-elapsed.*` | Synthetic localhost browser verification, with no real API/operational writes. |

Focused acceptance passed 24 tests covering the new rules, actual handlers and
existing atomic/Work Detail behavior. An earlier broader focused pass covered
53 payroll/submission/holiday tests; another 28-test review pass covers the new
25-hour tour limit and non-mutating historical discrepancy flag. Eight browser cases at 320/390/768/1280 pixels
in light/dark passed all five duration/error scenarios with no page errors or
horizontal overflow. Changed-file ESLint and TypeScript passed. The final
**`npm test` passed the production build and all 1,417 tests, with zero failures,
skips or cancellations**. The result is recorded
in `acceptance-results-20261017.json` and the downloadable bundle's final log.

The earlier synthetic local restore remains a local database/file-byte exercise,
not verification of a production Supabase/PITR/Auth/Storage restore. Those remaining
backup/destination/access approvals and original-record gaps are unchanged.
