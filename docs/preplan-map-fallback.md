# Preplan location fallback

Implemented and verified locally on September 12, 2026. The user subsequently approved pushing and deploying this change; the deployment outcome is recorded separately in the release receipt.

## Verified target and scope

The existing `D:\stickney-scheduler-member-release` checkout, branch `codex/scheduler-member-release`, GitHub `bobff353-creator/stickney-firehouse-manager`, Vercel project `prj_RTtTvD39FwyEGUovkPg8wxrdJCtF` were verified. Production remained READY on the prior `c455107` release. The user's open, unsaved production preplan was not navigated, reloaded or saved.

Story: opening an unlocated preplan starter or receiving unavailable device location should choose a town-wide Stickney map view, while located addresses and saved footprints retain precise views. This is client-side view selection; it adds no API polling, geocoding requests, database writes or migrations.

## Behavior

- The initial map uses the existing Stickney center (`41.8189, -87.7734`) at zoom 14 instead of 19.
- An imported address without both valid coordinates resets to that overview instead of inheriting the previous building/device center and zoom. Null, incomplete, nonnumeric, nonfinite, out-of-range and zero-pair locations are not treated as a found building.
- Located imported addresses open at zoom 20. Successful device location retains zoom 17. Existing saved-footprint fitting is unchanged.
- Starting a new preplan without current device location uses the overview. A successful current-location view remains usable for a new preplan.
- Manual device lookup failure, timeout or missing geolocation API resets only the map view, preserving draft fields and drawn geometry. Copy explicitly explains the fallback.
- A late automatic device callback cannot recenter a record or draft opened while the lookup was pending. The initialization callback is also cancelled on unmount.

## Verification

| Boundary | Evidence |
| --- | --- |
| Coordinate selection | Unit tests cover missing, invalid and valid values; saved footprint fitting regression passes. |
| API response to map | Local fictional API provides located and unlocated imported starters to the actual client component. Both map center and zoom are measured from rendered tile positions. |
| UI interactions | 17 browser scenarios passed at desktop 1518×666, tablet 768×1024 and phone 390×666. Includes denied/missing/timed-out GPS, located-to-unlocated navigation, new preplans, valid device location, late callbacks and actual pointer-drawn corners retained after failed lookup. |
| Persistence safety | All browser scenarios recorded zero saves. No production data was accessed by the isolated fixture. |
| Rendering | Desktop, tablet and phone screenshots reviewed; no horizontal overflow, application runtime errors or error overlays in the tested flows. |
| Automated checks | All 70 preplan tests passed; focused ESLint passed; production `npm run build` passed, including TypeScript and all routes. `git diff --check` passed. |

The browser-verification guidance led to explicit pointer, mobile, no-save and draft-preservation checks. An initial tablet automation click landed under a sticky header; scrolling the target to the viewport center fixed the harness. One cold browser-start timeout interrupted the next harness attempt before any scenario; the final run passed all 17. The harness allows a bounded 55-second browser command timeout.

Imagery is intentionally blocked by the fixture's CSP. Screenshots therefore show empty image tiles; this is not a production imagery outage. Tests verify the real fallback map and shared center/zoom inputs, not external Google imagery or physical GPS hardware. These local tests do not claim a production save or deployment.

Run the local preview with `node scripts/preview-portal-usability.mjs`, set `PORTAL_AUDIT_BROWSER` to the installed agent-browser executable, then run `node scripts/audit-preplan-location.mjs`. Evidence is written to ignored `outputs/preplan-location/`.
