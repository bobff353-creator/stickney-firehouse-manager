# Follow-up: baseline failures, policy questions and missing payroll evidence

Update: Bob clarified AO concurrency and actual elapsed DST hours on October 17
at 00:25:59 UTC. Those questions below are retained as historical review evidence,
not current unresolved decisions. See `clarified-ao-and-dst-rules-20261017.md` for
the implemented rule, tests and remaining representation/eligibility limitations.

Branch: `codex/firehouse-correctness-20261017`.
Application fixes remain in `c13979feff437d7f12bc4ab8dd3251ff7c212e24`.
The follow-up repairs in `2422aee5a9f22a471c43bc4f241f7ae5983d6f7e` repair test defects; no additional application or live security
change was justified by these 43 failures.

## Classification of all 43 failures

| Group | Count | Root cause and repair | Acceptance retained |
| --- | ---: | --- | --- |
| Missing department/request context | 26 | Location/Fleet (4), scheduling distribution (16), operational signal (1), login/remember-device (3), push sessions (2). Add explicit synthetic department and request-context providers to fixture loaders. Actual route, permission, adapter, and PostgreSQL logic still runs. | Unauthorized/foreign-department denial, clearance and availability, overlap, rollback, concurrency, PIN locks and outages. |
| Missing dependency/schema/renderer setup | 12 | Employee contacts (6): load employment helper, register synthetic login lookup, enforce batch cardinality. Vehicle controls (3): load real repair-finding helper and empty repair data. Home summary (1): supply newly imported document dependencies. Attachment headers (1): supply build metadata. Inventory reader (1): extract current dependency list and supply optional deep-link props. | Contact privilege boundaries, atomic rollback, numeric/issue validation, summary query bounds, attachment sandbox, stale-response suppression and post-save fresh read. |
| Obsolete workflow/source-shape expectations | 5 | Hydrants (1): assert reversible archive/restore and retained history rather than destructive deletion. Bulk review (1): assert individual unreviewed decisions and separate numeric/fluid readings rather than obsolete blanket pass. Local navigation (3): account for department prop and local equipment-aware URL construction. | Existing actual-handler hydrant history tests retained. New executable navigation and bulk-editor tests validate PIN check, local destination, lock/outage handling, failure evidence, retained confirmations, retry and never posting unreviewed rows. |

No test was skipped, disabled, marked expected-failure, or made to accept an error
response as success. Source-shape updates reflect existing upstream behavior,
with executable coverage added for the changed navigation and bulk contracts.
The six original new application regressions still run alongside these repairs.

Intermediate complete run after repairing these defects: **1,405 passed,
0 failed**. The final **`npm test` passed the production build and all 1,406 tests, with
zero failures, skips or cancellations**, including the new isolated local restore
test. Counts and commits are recorded in the acceptance JSON.
Changed-file lint and `git diff --check` are separate checks.

## Exact AO questions requiring the department's controlling policy

The 110 extracted entries in `db/policy-seed.json` were searched as structured
records. Policies 210, 307, 316, 331 and 1018 mention officer/acting-officer duties,
but do not define AO pay exclusivity or DST payroll. Existing payroll correction
and holiday documentation supports the formulas already preserved. It does not
resolve the questions below. A role label or scheduler qualification is not a
substitute for an approved pay designation.

1. **What exactly is the exclusivity scope and time interval?** If member A is AO
   06:00–12:00 at one station and member B is AO 08:00–10:00 on another apparatus,
   must B be rejected department-wide, or can separately defined scopes each have
   one AO? Does “one” mean one concurrently, one per named shift, or one per
   operational day? A noon handoff between A (06:00–12:00) and B (12:00–18:00)
   must be distinguished from a true overlap; do not impose one AO for an entire
   day unless the department explicitly requires it.
2. **Who qualifies and who can authorize the designation?** Is the saved
   `acting_officer_eligible` flag mandatory, do substantive officers qualify
   automatically, and do DPW/single-role/temporary employees have exceptions?
   Example: a firefighter with the flag unset is checked as AO in the Daily Log;
   should save reject it, require an authorized override, or record a pending
   review? Does a substantive Captain receive AO allowance, or only someone
   appointed to act above their ordinary role?
3. **How are split tours, overlapping rows, and corrections approved?** Example:
   A is recorded as AO 06:00–18:00, then B relieves A at noon. Must the first row
   be shortened before the second designation can save? Who can approve a
   retroactive designation or exception after handoff/finalization, and what
   audit evidence is required? Existing finalized-period guards remain enforced.
4. **Which recorded hours earn the allowance?** Are AO hours actual appointed
   hours, named-shift hours, or elapsed hours through DST? The current allowance
   is separate from worked hours and gets no additional holiday/OT multiplier;
   this review did not alter that established formula or set a new rate.

These are implementation decisions to request through the parent once the signed
policy/order and authorized decision-maker are identified, not assumptions to
encode as new payroll policy.

## Exact DST/time questions and examples

The operational day is already anchored to 06:00 America/Chicago. The current
`workedHours` calculation uses clock labels and treats equal in/out as a 24-hour
tour; it does not infer an offset or elapsed duration.

- **Spring forward:** 18:00 March 7 to 06:00 March 8, 2026 is 12 scheduled clock
  hours but 11 elapsed hours. Which hours are payable for shift, holiday, AO and
  DPW categories? Does the same rule apply to a 06:00–06:00 tour crossing the
  transition (24 clock versus 23 elapsed hours)?
- **Fall back:** 18:00 October 31 to 06:00 November 1, 2026 is 12 scheduled clock
  hours but 13 elapsed hours; a 06:00–06:00 tour has 24 clock versus 25 elapsed
  hours. Does the department pay the scheduled tour or actual elapsed duty, and
  how should overtime-threshold accumulation treat the repeated hour?
- **Ambiguous original records:** On November 1, “01:15–01:45” can mean 30 or
  90 elapsed minutes depending on which occurrence of 01:xx was recorded. HH:MM
  fields alone cannot prove it. If elapsed time controls, approved source dates,
  UTC offsets/timestamps or equivalent first/second-occurrence evidence are
  required. The code must not guess from the browser/server timezone.
- **Rounding and attribution:** Confirm any authorized historical exception to
  quarter-hour input, the treatment of partial intervals and where rounding is
  applied. Confirm whether holiday eligibility follows the operational shift
  date or actual calendar/elapsed portions in exceptional tours. For example,
  December 24 at 23:00 through December 25 at 07:00 crosses both the Christmas Eve
  18:00–06:00 window and Christmas Day; the existing operational-date/window
  behavior was retained without introducing observed-day substitution or stacked
  premiums. A signed exception could require different approved attribution.

Boundary tests prove operational-date rollover through both DST offsets. They
are not approval of a new DST wage rule.

## Missing records that block independent payroll reconciliation

No original attendance records or approved payroll exports were supplied or
retrieved for this review. Repository examples, current application totals and
schedules are not independent proof of what was worked, authorized or paid.
For each selected reconciliation period, the authorized reviewer needs:

- Original attendance/time records for each employee: actual dated in/out times,
  operational date/shift, original AO appointments, and any DST offset or repeated
  hour evidence. Include approved corrections and preserved versions/signatures,
  not only the latest editable Daily Log or planned schedule.
- Callback submissions tied to incident/call IDs, assigned reviewer decisions,
  approved hours, manual callback baseline and approved subsequent changes;
  original drill, Work Detail, DPW and other manual hours where used.
- Approved effective pay scales/rate history, overtime threshold and applicable
  period, employee DPW/AO eligibility and employment dates, approved holiday
  calendar/eligibility rules, and approved allowances/adjustments for that period.
- The independently approved/finalized payroll export or register for the same
  period and employees, showing category hours/rates, premium lines, gross and
  carry-forward corrections, with its approval/version. If reconciling amounts
  actually paid, the corresponding payroll processor's final register is needed.

Start with an ordinary period and periods covering a holiday, a pay-rate change,
callbacks and each DST transition. De-identified IDs can be used if original-to-
export linkage is preserved and an authorized reviewer confirms the mapping.
Do not copy sensitive production records into this workspace without explicit
approval for both source access and destination. Any absent original time record
or approved export remains a named reconciliation gap; do not manufacture it
from expected schedules or an application's calculated totals.

## Restore work completed and exact remaining blocker

`tests/isolated-restore.test.mjs` performs a genuine **synthetic local PGlite**
snapshot/restore into a fresh second database. It compares every row in 21 tables,
constraints, functions, triggers, policies and grants, checks linked records and
closed-incident state, denies anonymous/authenticated direct payroll reads, and
checks separately backed-up/restored synthetic file bytes by SHA-256. The measured
restore/check step was 640 ms in the focused run and 372 ms in the final full run; this is not a production RTO.
Temporary synthetic databases/archive/files were removed after the check.

A full production-recovery drill is still unverified. The available local Docker
daemon has no preinstalled images; `psql`, `pg_dump`, and Supabase CLI are absent,
and no configured isolated Supabase Auth/Storage stack or approved production
backup was provided. Local synthetic PostgreSQL work did not require new service
access or a paid resource. A real-backup drill needs an explicitly approved
backup source and destination (including permission to transfer sensitive data),
the compatible restore tooling/stack or existing funded isolated project,
separate Storage object backup, existing authorized access, and agreed RPO/RTO.
No such backup was accessed, no service was provisioned, and no new credential
was created. These approvals must be requested through the parent; they do not
block the independent code/test repairs completed here.

## Verified source/deployment evidence

- Remote deployed branch `codex/eso-review-fixes`:
  `f8466609294970261d74e717256675e367aff66b`; `main`:
  `e03428842255febd9a83539516a4d720265ce43c` at baseline verification.
- Production alias inspection identified READY deployment
  `dpl_AmHgNY5EQM5AUU9yxbuoKsaivk3A`, uploaded through CLI with no Git metadata.
- Its retained `src/.release-source.json`, file
  `697f909a50d924a63f24d56a85a47b0f167be2ef`, contained
  `{"commit":"f8466609294970261d74e717256675e367aff66b"}`.
- Both production and `test-firehouse-manager.vercel.app` were aliases of that
  same deployment; neither hostname was used for mutation tests. The retained
  source identity verifies baseline selection, not every deployed byte or live
  database policy. Public health access returned 403; no bypass was created.

The patch remains local. No push, deploy, live policy change, production record
mutation, production restore, hosted CI execution or paid provisioning occurred.
