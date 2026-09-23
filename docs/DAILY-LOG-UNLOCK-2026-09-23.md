# Daily Log corrections after administrator unlock

The administrator unlock endpoint changed the saved Daily Log row, which advances its database version. The screen enabled editing but retained the version from before unlocking. Its next save could therefore receive a 409 conflict and disable further editing despite showing "Unlocked for correction."

The endpoint now checks the version the administrator actually loaded, writes the unlock and audit entry atomically, and returns its exact new version from that same transaction. The screen records that version before enabling autosave. A stale unlock cannot adopt another editor's changes, and a failed audit write rolls back the unlock. Late responses for a different date are ignored. No department records or permissions are changed by this release.

Verification:

- The new integration test failed before the fix: the unlock response had no `saveVersion`.
- 21 targeted tests pass, including unlock followed by staffing/time/call/note corrections and payroll synchronization; stale, missing-version and unauthorized unlocks; rollback on audit failure; slow saves; edits during saving; lost connections; retry; version conflicts; and finalized payroll protections.
- The isolated browser fixture supports `?locked=1`. Unlocking and editing a note, staffing time and call times showed confirmed saves without a conflict. All fixture data is fictional, and outbound application API calls are blocked.
- Scoped lint and the production build are recorded with the release receipt.

Existing open screens need the updated application and a fresh saved version. Never discard a pending draft to reload: retain or export it and use the existing conflict review controls when needed.

## Release receipt

- Application source pushed: `9b585f245b904fc32c2f1904e9f73c553770387e` on `codex/daily-log-unlock-version-20260923`.
- Scoped ESLint and `npm run build` passed. Test, lint and build logs are under `outputs/daily-log-unlock-*.log`.
- Production deployment `dpl_sDHBouYNRhpjJpbcyQL3YKdvtZ3e` was verified READY with the matching source SHA and the `stickney-firehouse-manager.vercel.app` alias.
- The open production screen was checked for pending edits before refresh and returned to September 21, 2026. It displayed `Unlocked for correction`, `Saved to server`, and enabled staffing controls. The last saved timestamp remained 5:43 PM Central.
- No operational log or payroll entries were edited during live verification. Save behavior was exercised with fictional browser records and the database integration tests above.
