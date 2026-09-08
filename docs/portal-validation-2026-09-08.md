# Portal validation — September 7–8, 2026

Scope: current source plus a read-only walkthrough of the signed-in live administrator portal. This is not certification of every button, every role, or every production submission.

## Fixes from this pass

- Pushed availability recurrence as `e07f004` before starting the audit.
- Daily Log no longer presents failed loads as Saved with editable blank sections. A verified selected date is required before showing the form. Recovery offers Retry loading log, preserves device drafts, and retries a failed load after PIN unlock.
- Late responses for an earlier log date cannot overwrite the newly selected date; stale completion timers cannot re-enable autosave.
- Administrator log unlock and session PIN unlock recover from network failures instead of remaining stuck. Session PIN submit is disabled while pending.
- Shared activity timestamps prevent an inactive same-origin tab from clearing the PIN cookie while another portal tab is in use. Inner-panel scrolling counts as activity. Visibility changes flush a renewal request and start the background grace period. Thirty minutes without activity still locks; local timestamps never replace server PIN authorization.
- Locked content is inert, preventing keyboard interaction behind the PIN overlay.
- Updated old source assertions for the existing conflict guard, IFSI source constant/cache version, and revised session lifecycle.

## Live walkthrough coverage

| Area | Exercised without operational writes | Not exercised |
| --- | --- | --- |
| Scheduling | Admin to My Schedule; My Requests; calendar rendered | Assignments, offers, acceptance, approval; live build still has older navigation |
| Daily Log | Date loaded, failure state observed, callback expand/search/collapse | Staffing edits, call deletion, sign-in/out, callback submission |
| Inventory | Due Now; Repairs; Equipment; Reports; Meds & Stock | Starting/completing inspections, bulk pass, deletes, stock mutations |
| Equipment | Name search, apparatus filter, record detail, complete editor, Cancel | Asset save, retire, move, create container, delete |
| Repairs | Report deficiency and planned-maintenance forms | Submit, notify employees, close repair |
| Reports | Completed inspection detail and Close | Approve, request changes, print/email |
| Payroll | Global search navigation, Needs review filter, previous/current periods | Hours edits, finalization, export, correction submission |
| Respond | No-active-call state, recent-call review | CAD/status changes, manual calls, device enrollment |
| Safety inspections | Landing/history, Submitted filter, empty result, restore filter | Start, submit, reopen, evidence upload |
| Global navigation | Home, search/filter/open result, support link, inventory return | All remaining administrative/configuration screens |

Payroll currently flags two overlapping staffing records. The audit did not infer which historical entry to delete or alter.

## Verification and limits

- Full regression run: 462 passed, 0 failed. Production build and TypeScript checks passed.
- Regression coverage includes isolated database workflow tests, extracted real load/lifecycle execution tests, pure helpers, and source-pattern assertions. It is not all HTTP/browser end-to-end coverage.
- Added five Daily Log recovery tests and six session activity tests, including a mocked-clock execution of the actual idle effect. A real 30-minute multi-tab production soak has not been run.
- Production build checked after the code changes.
- The requested tablet viewport override did not take effect in Chrome (actual width remained 1517), so that attempt is not counted as tablet validation. Override reset afterward. No fresh comprehensive phone/tablet visual certification.
- Separate firefighter/officer accounts, controlled submission records, and the deployed latest build are still needed for full button-by-button acceptance. Live production was not deployed in this pass; Git pushes are distinct from deployment. Pending trade database migration remains separate.
- No live staffing, payroll, inspection, repair, stock, approval, or CAD records changed.
