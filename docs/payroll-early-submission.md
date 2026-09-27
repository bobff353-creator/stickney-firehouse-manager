# Early payroll submission and approved carry-forwards

## Administrator workflow

1. Open Payroll for the period you are sending. Save any edited hours first.
2. Open **Early submission & carry-forward → Prepare and review a submitted copy**.
3. Choose the last fully recorded staffing work date and a separate callback/work-detail cutoff. A staffing work date is the department's 06:00–06:00 operational day, not a partial calendar day. Preparing at noon September 24 with staffing through September 23 estimates the full September 24 and 25 operational days.
4. Build a preview. Review each employee, date, category, source and configured rate. Staffing after the cutoff comes only from filled, active positions in the saved department schedule. This is not a live Aladtec connection. Open positions generate no pay. Missing schedules, overlapping positions, unmapped employees, invalid rates and missing recorded logs block submission. Acting Officer eligibility/role does not invent an AO stipend.
5. Confirm and save the fixed submitted copy. Download its CSV and send it to the Village using the established process. Saving a copy neither transmits payroll nor marks wages paid.
6. Continue recording actual attendance and approving callback/work-detail records in their original dates. Do not finalize the working attendance period: the new submitted copy is immutable independently of those records.
7. Open the receiving period (for example September 26–October 10). Choose the original submitted period under **Prior-period adjustments**. Complete all original-period officer handoffs before approving differences.
8. Review each proposed employee adjustment and its supporting record, enter a reason, and approve it. Approved amounts are separate carry-forward dollars; they do not become new-period worked hours or pass through the new-period overtime threshold. Review any negative amount with the Village payroll process before approving it.
9. The receiving period's export/submitted copy includes the approved adjustments exactly once. If that period is already submitted, choose a later open period. Further changes generate only the remaining difference after earlier approvals, never the original amount again.

## Preservation and no-guessing rules

- Submitted copies store original source IDs, original work dates, names, pay rates, rules, category hours, estimate labels, approved incoming adjustments and calculated totals.
- Existing finalized periods without a saved submission are not backfilled from the current schedule. The September copy previously sent outside this workflow cannot be reconstructed automatically; its actual submitted records would be needed for a separately reviewed import.
- Ordinary correction requests remain requests; they do not automatically change wages.
- Missing attendance/unsigned handoffs cannot automatically become a deduction. Extra work is included only after it exists in recorded payroll; a pending request is not an estimate.
- Identical repeated submissions return the saved copy. Approved adjustments have a unique source-period/employee/sequence plus a deterministic review ID. Concurrent/stale approvals fail closed. Snapshot, adjustment and audit writes are one transaction.
- Posted history is append-only. Fix original attendance and compare again for a new correction; never edit/delete the submitted snapshot or an approved carry-forward.

## Release and verification

Apply `20260927222152_payroll_early_submissions.sql` before deploying this application version. It adds private tables and source-version triggers; it does not create submissions, approve adjustments, copy real attendance, change rates, or backfill historical payroll. Keep existing finalized-period protection intact. Deploy the migration and app together because CSV export checks the new saved-copy endpoint.

Local verification uses fictional records only:

- `node --test tests/payroll-submission.test.mjs tests/payroll-submission-api.test.mjs`
- Existing payroll calculation/export/review/corrections/sync/rounding and portal atomic-save tests.
- `node scripts/preview-payroll-submission.mjs` opens the actual component and API handlers against isolated in-memory PostgreSQL on port 4199. It never loads production credentials or writes live records. Stop the process to discard its fictional database.

Live migration installation, authenticated production walkthrough, Village export acceptance and any import of already-sent historical payroll are separate release/acceptance steps. No automatic payroll transmission was added.

### Local verification completed September 27, 2026

- Production build, TypeScript and changed-file lint checks passed.
- All 56 targeted payroll/Daily Log and atomic-save checks passed, including simultaneous submissions, stale previews, transaction rollback, lost responses, retries, original-period rates and duplicate adjustment protection.
- The full suite passed 1,007 of 1,008 tests. The remaining failure is the existing source-text assertion named `typed readings cannot be presented as saved or submitted before explicit confirmation` in `tests/workflow-trust.test.mjs`; neither that test nor `app/inventory-operations.tsx` was changed by this work.
- Desktop and 390-pixel phone checks used the real submission component and API with isolated fictional records. One saved submission and two approved trade/callback adjustments remained exactly one submission and two adjustments after retries. Recomparison reported no new difference. Employee access was denied. These were not production-account or Village acceptance tests.
- No live migration, payroll record changes, historical import, push or deployment was performed.

### Production integration

The release is integrated on top of the newer `993a28d` production source, preserving its inspection features, payroll math fixes and department-format Excel export. Submitted and working exports use that same canonical payroll calculation; the Acting Officer allowance is frozen in the saved rules. Approved carry-forwards are separate fixed-dollar rows with zero new worked hours, including negative amounts. Excel retains the supporting source/approval details on a separate audit sheet, labeled not to add those amounts again.

### Release verification — September 27, 2026

- Integrated source commit: `ce834a84cb08b6e887b3c7f4eb8e6c8c18e8edc1`, pushed to `codex/clear-first-screen-20260924`. The original implementation commit is also preserved on `codex/scheduler-member-release`.
- Production deployment: `dpl_DVqQCjua7rokj8uLs9GCCAXyhHLA`, built successfully and promoted to `https://stickney-firehouse-manager.vercel.app/` after database installation.
- Applied database migration: `20260927222152_payroll_early_submissions`. The local filename was aligned to the migration service's assigned version; no SQL behavior changed.
- Integrated build, TypeScript, changed-file lint and 74 targeted checks passed. Excel was reopened to verify negative approved dollars remain constants with zero additional worked hours. The previous full-suite result above belongs to the earlier source baseline, not a full-suite run of the integrated release.
- Verified all three new tables have RLS enabled, no direct anonymous/authenticated access and zero submitted/adjustment records. Existing record totals remained 1,003 time entries, 9,401.5 hours and 85 Daily Logs. A rolled-back, zero-row source update verified trigger execution under the existing private executor's owner without changing attendance.
- Deployment health returned HTTP 200; the new endpoint returned HTTP 401 without a signed-in session. No error/fatal logs were found for the deployment during the release scan. This does not replace an authenticated administrator acceptance walkthrough, and no real payroll was submitted or sent to the Village.
- Security advisors added only expected informational notices for the private tables' deny-by-default RLS. Existing unrelated security-definer and leaked-password-protection warnings remain outside this release.
