# Apparatus-scoped response progress

Implemented and verified locally September 12, 2026. The user subsequently approved pushing and deploying this change; the outcome is recorded separately in the release receipt.

## Story and verified target

The apparatus selection enters Respond, `/api/respond?apparatus=UNIT` supplies that unit's assigned active call, and local response steps are displayed and saved only for that department, call and unit. This is a browser-side progress aid, not a CAD status transmission or shared vehicle status service.

Verified checkout: `D:\stickney-scheduler-member-release`; branch `codex/scheduler-member-release`; remote `bobff353-creator/stickney-firehouse-manager`; Vercel project `prj_RTtTvD39FwyEGUovkPg8wxrdJCtF`. Base commit: `4ce1100cf71b5203feb1fb729aabc49c94bf27a8`. Target portal: https://stickney-firehouse-manager.vercel.app/. The user's production tabs were not changed.

## Behavior

- The department view and operations-alert overlay have no unit progress controls.
- A selected apparatus alone is insufficient. The response packet's apparatus filter must match, its active call must list that exact unit, and both department and call identity must be present.
- The panel explicitly names `UNIT … · CALL …`. General-view tactical navigation takes the full available toolbar width.
- Local saved progress uses separate department/call/unit keys. Switching identity cannot momentarily show or write the previous unit's step while its new packet is loading.
- Changes are disabled when offline, using an offline packet, or after a failed live request. They resume after a successful call check.
- Storage changes from another tab reload the matching unit. Before saving, the handler rereads the current step and refuses an action that is no longer a valid next step.
- Failed local writes do not advance the UI. Ended calls and removed assignments remove the controls. Timers and storage listeners are cleaned up on unmount.
- The new local store retains at most 100 entries. The legacy v1 browser store is left untouched but is not reused because it has no department identity. Existing unscoped browser steps are not silently attributed to a unit.
- No API, schema, permission, dispatch, GPS, or polling-interval changes. The existing 10-second Respond poll remains unchanged, and saving a local step adds no network/database request.

## Verification report

| Boundary | Result and evidence |
| --- | --- |
| Selection and call assignment | Shared exact-unit matcher and new scope tests reject department view, missing identity, mismatched response filters, partial unit matches and unassigned calls. Existing API apparatus selection was inspected and remains unchanged. |
| API response to UI | Actual Respond component exercised with isolated fictional `/api/respond` packets. General view and unassigned units hide the panel; delayed old-unit packets do not expose controls for the newly selected unit. |
| UI to storage and back | Clicks persist only the selected unit/call/department; reload, unit switching, call switching and department switching verified. Failed storage saves do not advance. |
| Failure and recovery | Simulated failed live response disables actions; successful reconnect restores them. Assignment removal and ended calls hide them. Storage-event refresh verified in the fixture; no separate physical-device synchronization is claimed. |
| Rendering | Desktop screenshot and acknowledgement click checked. Tablet 768×666 and phone 390×666 screenshots inspected; successful scenario checks found no horizontal overflow, framework overlays or captured runtime errors. |
| Cleanup and traffic | No operational write requests in the fixture. Unmount produced no further requests over a complete 10.5-second poll window. |
| Regression/build | All 77 Respond tests passed. Focused ESLint passed. Production Next.js build passed TypeScript and all 62 generated pages. `git diff --check` passed. |

Browser evidence is in ignored `outputs/respond-progress/`. The final continued audit recorded 23 passing remaining scenarios after separate desktop checks and initial tablet checks. Early harness attempts encountered a DOM serialization mistake, a cold browser process timeout, and unsupported text selectors; these were test-control failures, not application failures. The harness was corrected to return boolean wait conditions and use supported role/name clicks. Already-passed initial checks were skipped when continuing the remaining scenarios.

The browser-verification guidance drove the real click, reload, failure, isolation and responsive checks. React storage guidance drove explicit versioning, minimal scoped values, bounded history and guarded storage access.

## Reproduce

1. Run `node scripts/preview-respond-progress.mjs` (port 4196; fictional APIs only).
2. Open `http://127.0.0.1:4196/tests/fixtures/respond-progress.html` using `agent-browser --session respond-progress open …` before invoking the harness. This avoids the observed cold-start child-process output timeout.
3. Set `PORTAL_AUDIT_BROWSER` to the installed native agent-browser executable; run `node scripts/audit-respond-progress.mjs`.
4. The harness closes its own browser session. Stop the preview server afterward.

No authenticated production save, live dispatch, external map/GPS operation, cross-device sharing, or production deployment is claimed. The panel continues to say that it saves only in this browser and does not change CAD status or other devices.
