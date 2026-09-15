# Traffic economy pass — September 15, 2026

## Status and scope

Local source changes only; this document does not certify a deployment or a lower bill. Target: `stickney-firehouse-manager.vercel.app`, repository `bobff353-creator/stickney-firehouse-manager`, branch `codex/scheduler-member-release`. No live records, subscriptions, database schema, or paid plans changed.

Reviewed the app's recurring request/timer paths, including Live Operations, Respond, location sending/receiving, Inventory, Home, permissions/session checks, shared public feeds, Daily Log, scheduling, and incident command. This is a focused traffic audit, not a claim that every line or every possible interaction has been exhaustively tested.

Read-only production runtime logs corroborated repeated Respond, permission, dashboard, duty, suite-context, chief-board, river and location reads. Retained logs are not a complete billing counter, and no dollar-saving percentage has been measured.

## Implemented

| Area | Change | Boundaries preserved |
| --- | --- | --- |
| Main board data | Three browser requests become one `/api/live-operations` request every 30 seconds. Original handlers execute in parallel inside that request. | Each handler's permissions, department scope and CAD/Daily Log reconciliation still run. The live-call acknowledgment exception follows the new route; sign-in/PIN/membership still apply. |
| Repeated board content | An authenticated unchanged response sends HTTP 204 instead of the entire packet. | The server still verifies access and rereads the original sources. Failed/denied reads never confirm stale data. |
| Respond | Full reference validations can confirm unchanged content with 204, in addition to the existing cheap revision checks. | Calls/permissions still checked every 10 seconds; reference data still validated at the existing 30-second boundary. Selected call/apparatus scope is part of the revision. |
| Inventory | Unchanged successful GET responses can return 204; the active panel retains its confirmed packet in component memory. | Five-second visible refresh, mutation acknowledgment, conflict protection, current authorization, department filters and record completeness unchanged. Hidden/offline pausing already existed and is retained. |
| Open board/Respond screens | A successfully displayed push sends a small refresh hint to open windows. | No incident or personal details in the hint. Each window reads through its normal authority. Window messaging runs outside the CAD display queue. Push-only operation is not assumed. |
| TV synchronization | Main board, weather-header, chief-board and staffing rotations derive their position from the clock. | No network request for rotation. Normal interactive controls remain. Devices need reasonably correct clocks; different permissions/data or manual pauses can produce different views. |
| Vehicle GPS | First good fix, movement and final stopped fix are sent; repeated parked coordinates are suppressed in browser and Windows senders. | Moving/response cadence, accuracy/freshness checks, sender lock, private broadcasts and viewer permission leases remain. Old coordinates age visibly as last known, not proof that a parked device is still online. |
| Home | Counts use small summary queries instead of downloading complete policy/box-card bodies and revision histories. Hidden Home tabs stop nonessential refresh and refresh when visible again. | Document permission enforced before counts. Full document screens and histories unchanged. |
| River feed | Use Next's five-minute upstream cache and existing public response caching instead of Cloudflare-only fetch options and forced client no-store. | Public NOAA data only; observation time and errors remain visible. Private department data is not CDN cached. |

The conditional packet reader is component-owned memory, not localStorage or a shared account cache. It clears on definitive access denial and rejects abandoned reads. Respond keeps its separately existing, visibly labeled offline-preplan behavior; it does not relabel cached records as current during an outage.

## Projected request savings

Continuous operation, excluding initial loads, retries and extra push-triggered reads; 30-day month. These figures cover the three core board reads only, not all app traffic.

| Always-on TVs | Core reads/day before | Core reads/day after | Saved/day | Saved/week | Saved/30-day month |
| --- | ---: | ---: | ---: | ---: | ---: |
| 2 | 17,280 | 5,760 | 11,520 | 80,640 | 345,600 |
| 3 | 25,920 | 8,640 | 17,280 | 120,960 | 518,400 |

Formula per screen: `86400 / 30 seconds × (3 old requests − 1 new request) = 5760 fewer requests/day`.

Five rigs reporting unchanged positions every two minutes previously meant 3,600 parked uploads/day, 25,200/week, or 108,000 per 30 days. The new sender eliminates that repeating parked cadence. It still sends initial positions, actual movement, stops and necessary retries; GPS drift and restarts can also produce uploads. Moving mileage/hours are needed for a meaningful total projection.

HTTP 204 also saves repeated response bodies for board, Respond and Inventory, but does not eliminate the request, authorization, database reads or hashing work. Request counts alone cannot predict Vercel dollars: transferred bytes, function duration, plan allowance and other workloads matter. Forty-five members' usage depends on how long and which screens they keep open.

## Deliberately retained / next-stage work

- This is not a conversion to an event-only application. Respond's 10-second and board's 30-second fallback checks remain. Push may be unavailable or a browser can miss/disconnect from a message.
- Vehicle receivers already use private Supabase live broadcasts. The minute-rotating viewing lease and join/catch-up snapshots remain so revocation and missed movement are handled. Suppressing parked uploads does not remove receiver authorization traffic.
- News/weather/training already have shared saved-feed schedules; no added per-TV scraping. Chief-board (30 seconds), staffing (60 seconds), permission (15 seconds), session/PIN, and incident-command checks were not slowed down.
- Daily Log's clock rollover and autosave/conflict checks, scheduling's display clocks, payroll saves, incoming-CAD processing, reminder schedules and push outbox retries were not reduced. A local display timer is not inherently a network request.
- The bundle reduces separate requests/proxy authentication work, not the three handlers' database reads. Safely reducing those reads further requires a durable department-scoped change/version signal across every relevant writer, tested for missed events, time-driven shift changes, reconnect, access revocation and fallback. No new broad database access or public event channel was introduced.
- Further large-record improvements include paged historical Inventory reads and immutable/private photo caching review. Do not trim operational records or shorten retention to obtain savings. Google map loads and route/location-provider charges are separate from these Vercel request savings.

## Verification and rollout

Validation completed: 347 relevant regression tests passed (zero failures/skips), production `next build --webpack` passed, TypeScript and changed-source lint passed, and the Windows tracker compiled and passed its no-GPS/no-network self-test. Automated coverage exercises bundled reads, unchanged/changed/error/denied responses, Inventory department filters and mutations, Respond selection and revisions, and push/GPS safety. A local two-tab browser fixture uses clearly labeled fictional records; it verifies aligned rotation, unchanged responses, one incoming-call alert per simulated incoming call, and apparatus commitment. It is not a live multi-device or production push delivery test. The temporary fixture tabs/server were closed after checking.

Before claiming realized savings: deploy the reviewed release, verify the main alias, reopen/update the app on station devices, then compare the same Vercel usage window and endpoint transfer/duration. Keep dispatch/radio primary and verify actual incoming calls, reconnect recovery, permission revocation and each rig's first/moving/stopped positions.

Windows companion users must close the old tracker, download the updated `StickneyVehicleTracker.cs` beside the existing launcher, and rerun `Start-StickneyVehicleTracker.ps1`. Existing compiled copies do not update themselves. Browser devices need the new app/service-worker version; no rig was restarted or reconfigured by this audit.
