# Review Daily Log conflicts without retyping

Daily Log now offers **Review changes & continue** when a device draft conflicts with the saved log. Users compare the two copies, choose the staffing and call fields to keep, choose a complete Notes & Handoff copy, and save their selections. The previous download-and-retype path is no longer required; downloading a backup remains optional.

Matching drafts resume against the verified saved version without another write. Draft recovery compares content instead of device timestamps, so an older unsaved draft remains available after another editor saves later. Review fetches current data only on request; no polling was added.

Both original copies and their versions are backed up locally before a reviewed draft replaces the working copy. A failed backup stops recovery without changing the draft. The existing version-checked atomic log/payroll save handles corrections, so another save during review causes a new conflict without overwriting it. A failed save retains the selected draft and offers Retry. Locked logs retain administrator-only unlock, including within review.

Verification:

- Targeted tests cover field choices, additions/removals, exact note preservation, backup failures, old and identical drafts, stale review dates, expected save versions, no-write recovery, slow/lost saves, and transactional payroll protection.
- Fictional browser checks exercised mixed selections, another editor saving during review, locked-log unlock and recovery, matching drafts with zero saves, failed saves and Retry.
- The 343-pixel phone layout was visually checked, including readable text, tap targets, and no horizontal overflow.
- Scoped ESLint and a production build passed. Test/lint/build logs are under `outputs/daily-log-recovery-*.log`.
- No actual Daily Log, staffing, call, note or payroll record was changed during verification. No database migration or paid infrastructure change is required.

Existing conflict screens need the updated application loaded. The existing device draft key is unchanged, so the new review can read those drafts.
