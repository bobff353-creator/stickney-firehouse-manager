# Live Operations Board: shared scheduled feeds

## Scope and release status

Implemented locally for the verified Stickney portal. **Not pushed, not deployed, and the production cache migration has not been applied.** No operational records or the user's open inspection were changed. Deployment requires approval.

Verified source: `D:\stickney-scheduler-member-release`, branch `codex/scheduler-member-release`, baseline `b0da429b01f9e7186aaa4a29325d9e0eb8984435`, GitHub `bobff353-creator/stickney-firehouse-manager`. Public target: https://stickney-firehouse-manager.vercel.app. Vercel project `prj_RTtTvD39FwyEGUovkPg8wxrdJCtF`, team `team_FKsqUlwVuPEmg1np62Gqcku9` (existing Pro plan). Supabase project `ukpdacqjmhvlhmrwxtcx` is the connected database. No existing feed-cache table or installed pg_cron/pg_net extension was found. Existing `CRON_SECRET` and `FIREHOUSE_DATABASE_SECRET` are reused; no additional credentials, provider, package, or plan are required.

## Before and after

| Feed | Previous request path | New source schedule, America/Chicago |
| --- | --- | --- |
| Firefighter Close Calls | Each board requested the API every 30 seconds. Origin used an on-demand 24-hour Next cache plus long CDN caching. A daily cron attempted explicit invalidation. Cold/expired caches could call the source on a viewer request. | One scheduled retrieval cycle at 6:00 AM and 6:00 PM, shared by all viewers. |
| USFA fatalities | Each board requested the API every 30 seconds. Origin requested latest records and the yearly count; response had one-hour CDN caching. Failed requests returned a hardcoded July 2026 snapshot. | One scheduled retrieval cycle at 6:00 AM and 6:00 PM. Failure retains the real last successful saved response, including its year and timestamp. |
| Classes | Board IFSI polling every five minutes, plus a global `training-route.js` request on every portal page. The script used a MutationObserver to rewrite training panels. Origin used an on-demand 24-hour cache; provider failures could replace listings with empty arrays. | Each of Romeoville, IFSI and NIPSTA is checked once at 6:00 AM. Separate cache rows retain successful data independently when one provider fails. All three remain in the React board rotation. |
| Weather | Each board requested the API every 30 seconds. Origin fetched NWS point/day/hourly data, with Open-Meteo fallback. CDN response TTL was 15 minutes; Cloudflare `cf.cacheTtl` hints did not establish a durable Vercel shared result. | One retrieval cycle each quarter-hour, shared globally. Failure retains the previous saved forecast and retries at the next quarter-hour. |

The previous CDN/Next caches mean API calls and external-source calls were **not necessarily one-to-one**. This change removes viewer-triggered source retrieval completely, rather than assuming each existing API request was an external fetch.

## Data and scheduling architecture

`Vercel Cron -> durable slot claim -> external loader -> atomic saved result -> cached public API -> board`

- `firehouse.board_feed_cache` holds six fixed source rows: weather, close_calls, usfa, and three training providers. Each stores JSON, the last successful timestamp, last attempt timestamp, attempted slot, next schedule, status, and a generic error code. It never contains employee, incident, apparatus, authentication, or department-private information.
- The new migration is `supabase/migrations/20260912104034_shared_board_feed_cache.sql`. A primary key on source supports indexed lookups; no operational/history tables are scanned. Row count stays bounded at six. Training retains the next 100 parsed classes per provider (the board displays a small upcoming list); records outside this public feed cache are untouched.
- Server reads and writes reuse the existing secret-verified `firehouse_server_sql` integration boundary. Browser sessions are not used. The new table has RLS and an explicit deny-direct-access policy; all direct PUBLIC/anon/authenticated/service_role table/function privileges are revoked. No new security-definer function or broad grant is added.
- A conditional INSERT/UPDATE claims a slot before external I/O. Only one overlapping/duplicate worker can claim it. A failed or crashed attempt consumes the slot; it cannot repeatedly call the provider. A later scheduled slot can recover.
- Successful payload and timestamp are committed in one UPDATE. Failure updates status only; payload and last-success time survive. Attempt IDs fence out stale workers and duplicate completions. Database failure before a claim causes **zero** source requests.
- The existing daily preplan-expiration job and its `15 9 * * *` schedule remain separate. Its old news/training invalidation has been removed. Both exact cron routes authenticate with `CRON_SECRET`; middleware now lets these signed jobs reach that authentication instead of requiring an interactive member login.

### Timezone and daylight saving

New Vercel schedule: `*/15 * * * *` at `/api/cron/board-feeds`. The worker checks due sources using `Intl.DateTimeFormat` in `America/Chicago`; PostgreSQL independently enforces the same schedule using `AT TIME ZONE 'America/Chicago'`. No fixed UTC offset is assumed.

The worker starts the 6 AM/6 PM feeds only in their scheduled quarter-hour; a delayed invocation may claim that slot through :14, but there is no out-of-window catch-up or force-refresh path. Normal provider work takes additional seconds. Vercel scheduling is not a hard-real-time guarantee. Weather has 96 slots on an ordinary Chicago day, 92 on the spring 23-hour day and 100 on the fall 25-hour day, always 15 minutes apart. News and USFA have two slots on all three days; each training provider has one.

### Meaning of an external check

The maximum applies to a **retrieval cycle**, not necessarily one HTTP message. Existing provider integrations are preserved: USFA needs two API responses per cycle; NWS normally needs point lookup plus daily and hourly forecasts; Open-Meteo may supply a fallback; Close Calls may fall back from WordPress to RSS; training providers can require calendar/session or course-detail requests. Each endpoint needed for that cycle is contacted only by the scheduled worker, never once per TV. Repeated Romeoville detail URLs are deduplicated.

## Browser and CDN behavior

- The board requests `/api/board-feeds?group=weather` and `?group=bulletins`, not four independently polling feed endpoints. Existing individual endpoints remain compatible saved-data readers and cannot import/call a provider loader.
- One subscription scheduler per browser shares concurrent reads across mounted boards. Weather is read around one minute after each quarter-hour; bulletins around one minute after 6 AM/6 PM. The evening bulletin read reuses that morning's classes; it does not fetch training externally.
- Public-source-only snapshots are retained in versioned localStorage. Navigation/reload reuses them until due. No user, department-member, or apparatus data enters this cache.
- Public CDN responses expire at the next planned read; a short 10-second, eight-entry origin cache coalesces concurrent database reads. These caches only wrap **database reads**, not source loaders. Loading or bypassing the CDN cannot trigger source I/O.
- While a scheduled worker is pending, browsers may read the saved cache every 30 seconds for up to five minutes. If the source failed, they wait for the next scheduled slot. If the saved-cache API itself fails, the browser retains its current payload and retries that read after five minutes. Reconnect/visibility events respect this deadline and cannot start overlapping requests.
- Ordinary hidden tabs pause the informational scheduler. TV-mode subscribers continue. Timers and pending requests are cleaned up when the last subscriber leaves.
- Labels quietly distinguish `Updated`, `Last saved`, and `Awaiting scheduled update`. Last-success timestamps are not replaced on failure. Old weather days are labeled as saved weather, not today's/tomorrow's current forecast; an expired hourly outlook is not described as the next four hours.
- Live operations retain their 30-second loop, call callbacks, apparatus commitment logic, reconnect behavior, and shift/date calculations. Feed loading no longer participates in the operational Promise.all. No operational stylesheet was changed. Pausing/resuming visual rotation no longer restarts the operational fetch effect.

## Verification

User story: Opening the board reads a shared saved snapshot without source calls; the scheduled worker refreshes it once per allowed slot; failures retain last-success data while live calls continue independently.

- Targeted PostgreSQL tests exercise the actual migration: overlapping/duplicate claims, result persistence, failed and crashed attempts, next-slot recovery, stale-worker exclusion, revoked direct privileges, invoker functions, and a primary-key query plan.
- The SQL schedule and application schedule agree in summer, winter, DST transitions, and year rollover. Full-day duplicate-delivery tests enforce the exact 92/96/100 weather, 2 Close Calls, 2 USFA, and 1-per-training-provider budgets.
- Ten concurrent simulated jobs claimed each due source only once; ten concurrent readers shared one origin database read and did not change external loader counts. Simulated client tests cover multiple mounts, persisted refresh/navigation, hidden versus TV tabs, reconnects, failure retention, timer cleanup and in-flight deduplication.
- Local browser -> HTTP -> PostgreSQL cache -> actual React board: two mounted boards generated two initial feed API requests, two database reads, and no external requests. All three training providers rendered. Both boards displayed a simulated incoming call and called their new-call callback while informational responses were deliberately stalled. These were fictional fixtures, not production calls.
- Phone 360x844, tablet 768x1024, TV 1520x666 and 1920x1080 rendered with no horizontal overflow, error overlay, or captured browser errors. Screenshots in `outputs/board-feed-optimization` were inspected. The first test wrapper omitted the portal workspace padding; it was corrected to match production. No product CSS change was needed.
- Final exact-source `npm test` passed (exit 0), including the production build, TypeScript, and the full Node test suite with the additional full-day DST budget test. Next generated all 59 pages successfully.
- Changed files pass ESLint (exit 0). Final full-project `npm run lint -- --quiet` reports 22 pre-existing errors in unrelated payroll files, older audit fixtures/scripts, and existing permission/respond tests; the earlier non-quiet run also reported 9 warnings. No unrelated lint cleanup was mixed into this optimization.
- Production security advisors were read as a baseline only; the new schema is not applied there yet. Existing advisories are unchanged: [RLS without policies](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) (23 INFO), [mutable function search paths](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable) (5 WARN), [anon executable security-definer functions](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable) (8 WARN), [authenticated executable security-definer functions](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) (25 WARN), and [leaked-password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) (1 WARN). This is not a clean whole-project security audit.

## Request reduction and remaining opportunities

Measured in the simulated normal 24-hour client run: **99 informational requests**, including initial loading (96 weather, initial bulletin load plus two scheduled bulletin reads). Old timer math: `3 * 2,880 + 288 = 8,928` informational API requests/day/continuously-open board, plus the global training-script startup request. Steady new schedule: about 98/day plus initial loads and bounded recovery reads. Estimated reduction: approximately **99%**, or **8,830 requests/day/board**; ten continuous boards could eliminate roughly **88,300 requests/day (2.65 million/30 days)**. This is an estimate of these API/Edge requests, not measured billing or total application savings. New server cron adds 96 requests/day globally, not per viewer.

External-source savings cannot be honestly assigned one production number without origin/CDN-hit measurements. Previously working CDN caches may already have limited normal weather origin retrieval to about 96 cycles/day per cache location and USFA to about 24/day. Cold starts, cache expiry, regions, failures and request cache directives could increase that. New durable limits do not multiply with viewers/regions/restarts. Close Calls may increase from an on-demand daily update to the explicitly requested twice-daily schedule.

Remaining unrelated board traffic is intentionally preserved: dashboard, daily duties and suite context every 30 seconds; Chief Board and river-gauge checks every 30 seconds; staffing schedule every minute; existing permission/session and safety-critical alerts elsewhere. The five 30-second calls plus the staffing minute call contribute about 15,840 requests/day/board before other portal activity. Relative to those visible loops plus feeds, this change is roughly a 36% reduction, not a 99% reduction of all portal traffic. Further reference-data revision checks could reduce fleet/schedule reads, but require a separate correctness review. River/weather-alert/incident refresh was not reduced.

## Files changed

- Board/UI: `app/operations-board.tsx`, `app/board-feeds-client.ts`, `app/use-board-feeds.ts`, `app/layout.tsx`; removed obsolete `public/training-route.js` (replaced by React-owned shared training data; the original script remains recoverable from Git history).
- Cache/scheduling: `app/lib/feed-schedule.ts`, `board-feed-types.ts`, `board-feed-store.ts`, `board-feed-reader.ts`, `board-feed-response.ts`, `board-feed-refresh.ts`; the Supabase migration above.
- Source loaders: `app/lib/external-feeds.ts`, `app/lib/weather-source.ts`, `app/lib/usfa-source.ts`.
- Routes/config: `app/api/board-feeds/route.ts`, existing weather/close-call-news/usfa-fatalities/training-sites routes, `app/api/cron/board-feeds/route.ts`, `app/api/cron/daily-refresh/route.ts`, `proxy.ts`, `vercel.json`.
- Tests/docs: `tests/board-feed-cache.test.mjs`, `tests/board-feed-client.test.mjs`, `tests/daily-feeds.test.mjs`, `tests/weather-route.test.mjs`, `tests/rendered-html.test.mjs`, `tests/helpers/feed-test-loader.mjs`, `tests/fixtures/board-feeds-audit.html`, `tests/fixtures/board-feeds-audit.tsx`, `scripts/preview-board-feeds.mjs`, `scripts/audit-board-feeds.mjs`, this document.

## Deployment gate and limitations

After approval: verify the same project/branch/database; apply the reviewed migration; rerun database privileges/security advisors; deploy the matching commit; confirm cron registration and its secret protection; verify public alias/health and saved-only routes; observe scheduled source updates and stored timestamps. No code should be called live until those steps pass.

A new empty cache must wait for its first scheduled successful source update. No viewer-triggered warm-up, fabricated seed, or out-of-schedule fetch is permitted. For a smooth cutover, apply the migration and run the scheduled worker on the deployment at the next 6 AM slot before promoting the public alias. If a source is unavailable at that first attempt, its widget shows an unobtrusive awaiting-update message until a later scheduled success. Serverless schedules can be delayed or missed; the last successful data remains visible but cannot be guaranteed current during an outage. Production cron execution, real external retrieval success, billing reduction, and hosted end-to-end persistence remain unverified until deployment.

Official platform references consulted: [Vercel Cron management and authentication](https://vercel.com/docs/cron-jobs/manage-cron-jobs), [cron scheduling limits](https://vercel.com/docs/cron-jobs/usage-and-pricing), [Supabase database roles](https://supabase.com/docs/guides/database/postgres/roles), [Supabase changelog](https://supabase.com/changelog).
