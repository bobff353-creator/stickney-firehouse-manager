# Apparatus locations — implementation and verification

Status: implemented locally on September 12, 2026. **Not pushed, migrated, deployed, or paired to any production vehicle.** No GPS was requested from this computer. Actual vehicle GPS and hosted Realtime acceptance remain deployment/device gates.

## Verified target

- Source: `D:\stickney-scheduler-member-release`, branch `codex/scheduler-member-release`, starting commit `b0da429b01f9e7186aaa4a29325d9e0eb8984435`.
- Git remote: `bobff353-creator/stickney-firehouse-manager`.
- Production: `https://stickney-firehouse-manager.vercel.app`.
- Vercel project `prj_RTtTvD39FwyEGUovkPg8wxrdJCtF`, team `team_FKsqUlwVuPEmg1np62Gqcku9`.
- Actual database: Supabase `ukpdacqjmhvlhmrwxtcx`; Stickney department `14a76771-4c24-481b-8def-e6cce005c17b`.
- Reuses current Supabase authentication, permission resolver, Fleet records, and server SQL credential. No provider/plan/security settings changed or new dependencies added.
- Separate informational-feed optimizations already present in this checkout were preserved. They are also unpublished; a later release must explicitly account for both change sets.

## User flow

Respond → Apparatus locations → select a unit to center it on the map. Department view includes paired frontline and reserve vehicles; **Include unpaired** shows the remaining actual Fleet records. During a call, expand Apparatus locations and choose all department units or only units assigned to that call. No apparatus numbers or reserve assignments are fabricated.

An administrator with Respond view access plus Settings management or Inventory setup management can expand **Set up / manage location tracking**, choose a vehicle and device name, and pair one sender. Pairing replaces the previous credential for that apparatus. Disable revokes it immediately for subsequent writes. Pairings expire in 90 days. Nothing starts tracking automatically on a personal phone.

### Mounted browser

Choose **This browser**, then explicitly allow its location prompt. Pairing uses a Secure, HttpOnly, SameSite=Strict cookie restricted to the ingest path. JavaScript stores only the vehicle/device identifiers, not the credential. A browser-wide lock prevents duplicate sending tabs. After a reload, select Start sharing again. Changing from idle Respond to an incoming incident does not unmount the sender.

The browser page must remain visible. Hidden ordinary pages pause location reception; apparatus-scoped/fullscreen Respond monitors keep receiving. Browser geolocation itself cannot promise background acquisition, regardless of a monitor flag.

### Surface / Toughbook Windows companion

Choose **Windows companion**, copy its one-time setup, and save both downloadable source and launcher files in the same folder on the mounted Windows computer. Run the launcher in Windows PowerShell, paste the setup, then Start sharing. It runs separately from the browser and keeps operating when minimized or another application is foreground.

The launcher compiles a small .NET Framework desktop application using the Windows location provider. It does not install a service, change execution policy, alter power settings, or register automatic startup. Organizational Windows policies still apply. Start it again after restarting/signing in. Windows must stay awake, connected, and permit location access. Sleep, logout, hardware/provider failure, or an unavailable internet connection stop fresh updates.

Only the device credential is stored locally, encrypted with Windows DPAPI for that Windows user. No portal password, administrator PIN, or account token is placed in the companion. It rejects setup pointing outside the exact production HTTPS ingest endpoint and rejects redirects. One instance per Windows session is allowed.

**GPS hardware has not been verified.** Vehicle Wi-Fi supplies connectivity, not proof of satellite GPS. Windows/browser location may be derived from other sources. Accuracy and freshness checks are enforced, but they do not independently prove the physical position. A vehicle walk/drive test is required before operational reliance. No live success or equipment capability is assumed.

## Data and performance

| Activity | Behavior |
| --- | --- |
| Incoming CAD / Respond | Existing 10-second poll unchanged; no GPS work added to dispatch or call queries |
| Browser moving on assigned call | At most one position POST every 5 seconds |
| Browser moving otherwise | Generally one POST every 15 seconds; motion-state transitions can send after 5 seconds |
| Windows moving | At most one POST every 5 seconds, independent of whether Respond is open |
| Stationary | One fresh position heartbeat every 120 seconds |
| Device acquisition | Local GPS/provider callbacks; these are not database/API requests |
| Receiving locations | One shared private subscription per browser document, initial snapshot plus post-join catch-up, renewed approximately each UTC minute |
| Permission renewal | Rechecks actual permissions and renews a one-minute user/department viewing lease; rotates private topic so old joined sockets receive no subsequent-minute positions |
| Failed requests | No overlap; bounded retry/backoff; stale labels retained; denied access clears positions |

Each receiver normally performs two small snapshot GETs per minute: initial/join renewal and race-closing catch-up. Separate devices/documents have separate subscriptions; there is no cross-device request deduplication claim. Each snapshot reads current Fleet plus current positions, not preplans, equipment, historic calls, or building lists. It also performs current authentication/permission checks. Snapshot results are bounded to 100 active Fleet apparatus; this department currently has nine, not an unbounded dataset.

Only one current application position per apparatus is stored. No application route-history table is introduced. Supabase may retain temporary broadcast messages under its managed retention policy. Pairings and viewing leases are bounded by Fleet/users. No coordinates or device secrets are put into public CDN caches.

Measured in local browser verification: four Respond components in one document required **two initial location GETs total**, then all four received a movement update with **zero additional location GETs**. This is deduplication evidence, not a measured production bill saving. A deterministic 24-hour stationary simulation produces **720 position updates per vehicle**, including its initial fix. For five continuously parked vehicles that would be 3,600 updates/day; this is an estimate based on cadence, excluding retries, viewing requests, and actual movement. Real GPS traces, billable Vercel invocations, and Supabase message totals were not measured.

## Correctness / security

- The device credential, not a submitted apparatus ID, determines which vehicle can be updated. Only its SHA-256 hash is stored server-side. Device tokens cannot read operational records or alter call assignments.
- Accepts finite coordinates, claimed accuracy better than or equal to 75 metres, and a measured fix no older than 30 seconds / no more than 5 seconds ahead of server time. Bad/default/old fixes never replace a confirmed position. Devices should have correct time synchronization.
- A row lock, minimum spacing, monotonic sequence, and rejection of older fixes serialize duplicate senders and prevent position rewind. Tokens stop working after replacement, disable, expiry, or Fleet retirement.
- A displayed moving fix becomes Last known after 30 seconds; stationary after 180 seconds. Disconnection/disabled tracking marks it Last known immediately. Timestamps continue aging locally without database writes. Reconnection does not invent a new fix timestamp.
- Viewer grants are current user/department leases, not permanent grants. Changed permissions are enforced on renewal, within about one minute. Already delivered data cannot be withdrawn from a malicious client. This is a per-user lease, not independently authenticated per-browser-session Realtime access.
- No authenticated/anonymous direct writes to tracker data or view leases. No client broadcast-send policy. Private Realtime RLS only allows a user's unexpired authorized topic. Existing production Realtime policies were inspected read-only before implementation; no broad pre-existing policy was found.
- New functions are invoker-security with empty search paths and direct execution revoked. Trusted server operations use the existing secret-protected SQL boundary; no new privileged SQL gateway is created.
- Production SQL wrapper inspected read-only: read modes wrap SQL in a subquery. Pairing/lease writes therefore return through dedicated invoker functions, avoiding unsupported INSERT RETURNING subqueries. API fixture reproduces the actual wrapper.
- Production `realtime.send` inspected read-only: it catches insert errors and warns. The trigger verifies the broadcast receipt using the existing indexed timestamp/topic lookup before committing. Missing receipt rolls back the position/pairing change; a failure is not reported as saved. This proves enqueue, not delivery to an offline device. Joining receivers fetch a catch-up snapshot, and minute renewals recover missed events.
- Token lookup uses its unique index; receiver lease uses its user/department primary key. Broadcast receipt uses the provider's existing partial timestamp/topic index and exact transaction timestamp, allowing partition pruning. No optional tuning commands run on startup.

## Verification evidence

- `npm test`: production Next.js build, TypeScript and **604 tests passed (0 failures)**. The final location-specific rerun also passed **13/13** after the SQL-wrapper/receipt and reconnect refinements. Changed-file ESLint and `git diff --check` passed.
- Location-specific API/domain/SQL/client/sender tests cover actual route handlers, actual permission calculation, actual SQL adapter result wrapping and PGlite PostgreSQL. They cover pairing, malicious apparatus override, ordinary-member setup denial, member permission exception denial, wrong department, cookie/origin rules, stale/invalid fixes, concurrent sends, replacement/expiry/retirement, direct RLS denial, atomic rollback on a missing broadcast receipt, stale labels, shared timers, hidden monitors, and sender cleanup.
- Windows companion compiled with the installed .NET Framework C# compiler; `--self-test` passed accuracy, freshness, cadence and exact destination validation. This self-test makes no GPS/network request. Actual Windows GUI, location hardware, lock/sleep behavior and cellular/Wi-Fi transitions were not tested on station equipment.
- Real React Respond browser rendering checked at **381×666, 768×1024 and 1520×666**: zero page overflow, no error overlay/uncaught errors, two unit cards and two corresponding markers; admin controls usable. Tablet method field widened after visual inspection.
- Browser fixture uses actual API handlers and PostgreSQL data. Hosted Realtime transport is replaced with local SSE; this is explicitly **not** an authenticated hosted WebSocket test. Google basemap is intentionally disconnected in the fixture; Google production imagery is not revalidated by these tests.
- Four simultaneously mounted Respond views received the same movement; incoming simulated calls opened on the existing timer while location fetching was deliberately stalled. Permission denial cleared locations, and reconnect reloaded them. No production dispatch, position, or record was created.
- Initial browser verification caught an unbound native timer cleanup method; fixed and retested. Driver-only stale keep-alive connections were corrected separately. Do not confuse those fixture failures with production outages.
- Screenshots and machine-readable results: `outputs/apparatus-locations/`. Test fixture source is under `tests/fixtures/`, with `scripts/preview-apparatus-locations.mjs` and `scripts/audit-apparatus-locations.mjs` for reproduction. These are local-only, visibly fictional fixtures; they are not production routes.
- Changed production TypeScript/React files passed ESLint. The pre-existing repository-wide lint baseline has unrelated errors; this is not represented as a clean full-repository lint run.

## Release / remaining gates

1. Obtain approval for this release, including any other pending feed changes. Verify Git remote, branch, Vercel project/domain and Supabase project again. Do not push/deploy the whole dirty checkout blindly.
2. Review and apply `20260912164513_apparatus_location_tracking.sql` only to the verified project. It creates new objects and a Realtime receive policy, preserves existing Fleet/preplans/photos/history, and does not modify managed Realtime table structure. No runtime schema bootstrap is used.
3. Deploy the approved source; verify production build/health, authenticated location GET, admin/member access, private Realtime join, and no public read/write bypass. Test actual notification enqueue plus delivery on the hosted provider before calling it live.
4. On an authorized vehicle, explicitly pair its mounted device. Test accurate stationary/moving location, replace/revoke, real incoming-call assignment, foreground/background, restart, sleep/wake, poor GPS, Wi-Fi reconnect and stale labeling. Test separate physical screens; four components in one browser are not four real tablets.
5. Leave reserves unpaired until requested. Keep conventional dispatch/radio procedures in use. This is an operational aid, not a verified replacement for a dedicated AVL/CAD system.

References: [Supabase Broadcast](https://supabase.com/docs/guides/realtime/broadcast), [Realtime authorization](https://supabase.com/docs/guides/realtime/authorization), [Windows GeoCoordinateWatcher](https://learn.microsoft.com/en-us/dotnet/api/system.device.location.geocoordinatewatcher?view=netframework-4.8.1), [W3C Geolocation](https://www.w3.org/TR/geolocation/).
