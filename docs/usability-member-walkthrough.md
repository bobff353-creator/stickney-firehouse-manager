# Usability finish and member walkthrough

## App-side changes

The earlier usability release fixed invalid Daily Log save timestamps, role-aware Home priorities, operational status wording, coordinate-based hydrant fallbacks, explicit review/submission steps, and CAD freshness warnings.

This follow-up adds:

- One contextual return in Scheduling and a focused Preplan, with section/record/task context. Preplan search and directory position stay intact. Standalone modules retain their own return button.
- Opening a preselected shift no longer triggers an unsaved-work warning by itself. Actual trade-form changes remain protected, and a successful submission resets that protection to the saved state.
- A persistent saved-assignment status; typed mileage is unsaved until explicitly recorded. A check cannot be submitted with an unrecorded changed reading.
- Repair-notice save/failure/retry status, retained details on failure, and a secondary Refresh action.
- Daily Log officer-approval failure recovery and duplicate-click protection. Saving the log remains separate from officer sign-off; required-check verification and permissions are unchanged.
- A sticky phone Respond context/warning and staffing grouping before TV pagination. Underlying assignments, role details, call timing, and data are not removed or changed.

## Agent verification — local fictional records only

Tested at 390 × 844 and 1368 × 768 using the actual UI components with isolated API fixtures. External records, notifications, payroll and schedules were not modified.

Automated verification: the full 914-test suite passed; targeted follow-up checks for the final navigation and style adjustments passed as well. The tests include database/permission regression coverage using their existing isolated harnesses, not live operational acceptance.

| Workflow | Evidence |
| --- | --- |
| Find next shift | Member view shows the assigned date, role and times; opening a trade and returning restores My shifts. |
| Complete a check | Changed mileage shows Unsaved changes; failure retains the value; retry saves; complete results lead to Review & submit; submission says awaiting administrator review. Decimal readings are supported. |
| Report a problem | Authorized Repairs view has Report a problem as the primary action; failed save retains notes; retry shows Saved and the repair in history. Existing permissions remain enforced. |
| Find a preplan | Filtered directory opens the building; one Back to Preplan list restores the search and directory position. Phone layout has no horizontal overflow. External map tiles were blocked by the isolated fixture, not tested live. |
| Daily Log handoff | End-of-log handoff opens review; simulated disconnection retains the officer's notes; retry closes the dialog and changes the signed-off count. This does not replace an authorized officer's real review. |

Additional checks: Respond apparatus 1205 shows only its selected incident, interrupted-update warning and disabled progress changes; its context remains visible while scrolling on a phone. The previous production release remains separate from this local follow-up until publication is authorized and verified.

## Real-member acceptance — not yet performed

Use an authorized member's own account, then repeat on a phone and station computer. For officer handoff, use an authorized officer. Do not grant extra access just for this test. Use a staging/test environment or a genuinely due workflow; never create pretend operational records in production.

Give only these task prompts, without pointing at controls:

1. Find your next shift and tell us the date, hours and assigned role.
2. Complete an authorized apparatus check and explain whether it is saved, submitted or approved.
3. Report an equipment problem using the path permitted to your role, and find its saved record.
4. Find a named preplan, open it, and return to the same search.
5. Review a Daily Log and complete an eligible officer handoff after required checks are verified.

Record the device, role, time taken, hesitations, wrong turns, backtracking, help needed and the answer to "Did that save?" Do not record PINs, private personnel information or incident details.

| Task | Phone result | Station-computer result | Observed hesitation / follow-up |
| --- | --- | --- | --- |
| Next shift | Pending | Pending | |
| Apparatus check | Pending | Pending | |
| Equipment problem | Pending | Pending | |
| Preplan and return | Pending | Pending | |
| Eligible Daily Log handoff | Pending | Pending | |

Acceptance: no coaching, no lost edits, correct permissions, no false save/completion state, and a clear return path. Any failed task needs another fix and repeat test before claiming member acceptance.
