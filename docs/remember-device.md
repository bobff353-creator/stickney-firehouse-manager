# Remember this device for seven days

Status: implemented and locally verified. Release approved by the user; deployment, migration and production acceptance evidence are recorded separately in `outputs/remember-device/`.

## Member experience

- Optional, unchecked **Remember this device for 7 days** on email/PIN sign-in, verified-email PIN entry, and the inactivity-lock form.
- Intended only for personal, screen-locked devices. Shared station computers should leave it off; the existing TV behavior is unchanged.
- A successful, newly entered PIN can authorize this browser for up to seven days. The deadline does not slide forward as the member uses the app.
- Without opting in, the existing 30-minute inactivity behavior remains. Unfinished work remains mounted behind the PIN overlay.
- Sign out forgets the browser. PIN changes, expired/deleted Auth sessions, and inactive department membership prevent remembered access. Current role permissions and mandatory confirmations still apply.
- Clearing cookies, private browsing, browser retention policies, provider session limits, or security events can require sign-in earlier. This is a browser/session lease, not proof of physical device identity. It does not change push-notification permissions.

## Verified source and infrastructure

- Source: `D:/stickney-scheduler-member-release`, branch `codex/scheduler-member-release`, based on `f4c070b466c1c4bc7f7436b4aa52578b32a4c02f`.
- GitHub: `bobff353-creator/stickney-firehouse-manager`.
- Vercel project: `prj_RTtTvD39FwyEGUovkPg8wxrdJCtF`; production alias `https://stickney-firehouse-manager.vercel.app`.
- Supabase project: `ukpdacqjmhvlhmrwxtcx` (Postgres 17.6). Its existing credential, session, membership and PIN-function definitions were inspected read-only before implementation.
- This is the verified Next.js/Supabase portal, not a similarly named Sites project. No hosting, provider, plan, JWT lifetime, or production Auth setting was changed.

## Security and data path

Story: member selects the option and enters a valid PIN → login/PIN route uses the authenticated Supabase session → one database transaction verifies the PIN and creates a bounded device lease → a secure cookie is set → subsequent portal and Inventory checks validate the same lease.

`20260912230102_remembered_portal_devices.sql` adds a private RLS-enabled table. Anonymous/authenticated clients cannot directly read or write its records. Only narrowly scoped functions can issue, inspect, or forget the current member's device.

- Cookie: existing `__Secure-firehouse-pin`, HttpOnly, Secure, SameSite=Lax, Path=/; maximum seven days only after explicit boolean `true` and successful verification.
- New token: random 256-bit value with a distinct prefix; only its SHA-256 digest is stored.
- Bound to `auth.uid()`, the actual existing `auth.sessions` row, and an active membership in the issuing department. The saved PIN hash's fingerprint invalidates leases after a PIN change.
- PIN verification and issuance are atomic. Wrong PINs retain existing rate limiting; no failed attempt issues a device.
- Absolute `expires_at` is seven days after creation. A read-only status function returns its deadline and server time. Existing normal/TV renewal functions cannot extend remembered tokens.
- At most twenty remembered sessions per member. Own expired/replaced records are cleaned on issuance; Auth/user deletion cascades to their device records.
- Token primary key, session/department foreign-key indexes, and user/creation index support lookup, deletion, and bounded cleanup. Local EXPLAIN confirmed index eligibility; no production performance reduction is claimed.
- No PIN, token, or new access grant is stored in localStorage. The existing cross-tab activity timestamp remains non-authoritative. Before an older tab deletes an idle cookie, it checks whether another tab has remembered the shared browser.
- Refreshes cannot overlap; security requests are bounded to eight seconds. Activity does not repeatedly renew a confirmed remembered lease. Resume checks and existing permissions/operational checks remain active; no incoming-call interval changed.

The design retains short-lived Supabase access tokens and ordinary refresh sessions rather than lengthening access JWTs. See [Supabase sessions](https://supabase.com/docs/guides/auth/sessions) and [server-side session guidance](https://supabase.com/docs/guides/auth/server-side/advanced-guide).

## Verification

- 76 targeted tests passed: actual Postgres/PGlite migration + pgcrypto execution, route handlers, PIN renewal, idle lifecycle, permissions, Inventory gates, and existing TV behavior.
- SQL coverage: fresh PIN, wrong PIN/lockout, user/session/department isolation, fixed expiry, non-renewal even for TV, membership removal, PIN change, sign-out/session deletion, own-device forget, twenty-device bound, transaction rollback, anonymous/direct-table denial, and usable indexes.
- Route tests confirm explicit opt-in only, secure cookie attributes, failed verification issuing no cookies, malformed/expired status failing closed, and current-session-only forgetting.
- Browser: actual AuthGateway and SessionIdleLock components with an explicitly fictional local Auth/API adapter. In-app browser passed checked sign-in → reload without PIN → required PIN lock → remembered unlock with draft preserved → sign-out with default-off option restored. Error logs were empty.
- Rendered and inspected phone (390×844 and 370×666), tablet (768×1024), and desktop (~1264 px) layouts. No horizontal overflow; the checkbox label has a 44px minimum hit area. Existing mobile sign-in page still scrolls vertically.
- The native agent-browser runner passed initial rendering/default-off/failed-PIN checks, but its scripted post-reload button interaction stalled on this host. Do not report that runner as a full pass; the equivalent interaction was verified using the separate in-app browser. Its failure evidence is under ignored `outputs/remember-device/` and the diagnostic script is retained for reproducibility.
- Targeted ESLint and the production build passed. The obsolete Live Operations source assertion was updated to read the already-shared menu module (mapping/enforcement unchanged).

These local checks do not constitute a production login/logout test, a physical seven-day endurance run, or a guarantee that an individual phone will retain browser data. No real member credentials were entered or production records changed during local testing.

## Release order and acceptance checks

Approved release procedure:

1. Reconfirm the Git branch, Vercel project, Supabase project and current production baseline.
2. Apply only the new remembered-device migration through the normal Supabase migration workflow. Do not apply unrelated pending migrations. Existing member/credential rows are preserved.
3. Inspect function grants, RLS and security advisors on the target; do not ignore new authorization findings. No service-wide Auth-setting change is needed.
4. Deploy the matching application and verify its Vercel SHA, readiness and health response.
5. Use an approved disposable test account/device to verify actual Supabase sign-in, checkbox off/on, refresh/reopen, forget/sign-out, and the current-permission gate. Do not sign out the user's active station/TV accounts for testing.
6. Only then call the feature live. Unchecked sign-in keeps the existing PIN RPC. If the new RPC is unavailable, checking the option shows an error and suggests trying again or leaving it unchecked; it never silently promises remembering.

For rollback, prefer a forward fix. Rolling back application code alone leaves old code unable to renew the new token format and will require affected members to enter a PIN again. Do not drop the table or erase existing operational records as a rollback shortcut.

## Reproduce locally

Run the targeted `tests/remember-device*.test.mjs`, `tests/pin-renewal.test.mjs`, `tests/session-activity.test.mjs`, and existing permissions/session suites with Node's test runner, followed by `npm run build`.

`node scripts/preview-remember-device.mjs` starts an isolated UI fixture on `http://127.0.0.1:4183/remember-device.html`. Its sample identity is fictional; API calls are replaced in this fixture only. `?reset=1` starts the fictional sign-in flow and `?pin=1` starts a verified-email PIN prompt. Production code does not import the fixture adapter.
