# Stickney Firehouse Manager for Power Apps

Source for the first slice is `df3338bcc9aa45fabc105b4cba4b89921b8c8c28`
on `codex/supabase-separation-20261112`. GitHub reported an identical branch
head on November 17, 2026 (Central). The original Vercel deployment revision
could not be read from this workspace.

The target is one Village-owned Power Apps Code App and its own backend,
database, storage, and identities. The review entry renders the original
Daily Log React component and calls the server routes from a separately
configured copy of this checkout. Keep the source app's backend, database,
identity sessions, storage, webhook credentials, and webhooks out of the
candidate environment. The standalone branch requires explicit Supabase configuration and rejects the original project host. A historical import will need a reviewed migration
that retains IDs and relationships.

## Review build

Use Node 24 and `npm ci`. Run `npm run power-apps:build` to build the Vite
client to `dist/power-apps`. Configure this checkout with an isolated
database and test identity setup, then run `npm run build` and
`npm run power-apps:review`. Open
`http://127.0.0.1:3000/power-apps/index.html`. The review command binds
the separate backend to loopback and serves the review assets on the
same origin. Sign in through that origin. The existing department access
check, required confirmation check, and staffing roster request run before
the Daily Log opens. The bundle has no configured hosted transport and
shows a connection status outside the local review URL.

Power Apps publishing requires a signed-in Village maker, a target
environment with Code Apps enabled, and eligible licensing for users.
The hosted transport still needs an approved per-user identity design
and an independently provisioned backend. A Power Apps sign-in alone
does not establish a Firehouse department membership, PIN state,
employee link, or permissions. Verify those checks through the hosted
transport before publishing. No Microsoft app ID or backend secrets
belong in the Vite source or build.

Microsoft references are the [Code Apps overview](https://learn.microsoft.com/en-us/power-apps/developer/code-apps/overview),
[app initialization and publishing](https://learn.microsoft.com/en-us/power-apps/developer/code-apps/how-to/create-an-app-from-scratch),
and [data connections](https://learn.microsoft.com/en-us/power-apps/developer/code-apps/how-to/connect-to-data).

## Daily Log parity checklist

| Behavior | Source | Verification status |
| --- | --- | --- |
| Three original shifts, staffing fields, applicability, equipment accountability | `app/daily-log.tsx`, `app/daily-log.css`, portal styles | Original component bundled. Real-record visual and responsive comparison pending. |
| Scheduling prefill remains unconfirmed and linked to actual staffing | `app/department-schedule.ts`, `app/api/logbook/route.ts` | Original code path reused. Existing save reliability test covers unconfirmed scheduling. Authenticated scheduling-to-log flow pending. |
| Central operational day and lock grace, AO coverage, DST occurrence selection | `app/operational-day.ts`, `app/staffing-time.ts`, `app/time-occurrence-select.tsx`, `app/staffing-payroll-server.ts` | Existing operational day and AO/DST tests passed. Authenticated browser verification pending. |
| Military time, explicit edit of completed calls, callbacks, dispatch closure | `app/daily-log.tsx`, `app/daily-log-workflow.ts`, `app/api/callbacks/route.ts`, `app/dispatch-closure.ts` | Existing workflow, callbacks, and dispatch closure tests passed. Independent dispatch delivery and closure verification pending. |
| Notes, legacy free text, timestamps, statuses, prior-seven-day view | `app/daily-log-notes.tsx`, `app/daily-log-workflow.ts`, `app/api/logbook/route.ts` | Existing workflow and recovery tests passed. Authenticated historical notes verification pending. |
| Department rights, officer qualification, notes acknowledgement, duty acknowledgement, unavailable or incomplete fleet check gates | `proxy.ts`, `app/server-permissions.ts`, `app/api/logbook/route.ts`, `app/lib/fleet-projections.ts` | Original access and server routes reused. Existing fleet gating and concurrent approval checks passed. Independent identity, role, department, and actual fleet projection verification pending. |
| Atomic save and payroll updates, preserved employee and row IDs, finalized-period protection | `app/api/logbook/route.ts`, `app/payroll-hours.ts`, `app/staffing-payroll-server.ts`, `supabase/migrations/` | Source route verified in isolated PostgreSQL test fixtures. Independent database migration and authenticated cross-module verification pending. |
| Versioned saves, timeout and missing receipt, draft review, administrator correction | `app/daily-log-save-request.ts`, `app/daily-log-recovery.ts`, `app/daily-log-recovery-review.tsx`, `app/api/logbook/route.ts` | Existing reliability, load, recovery, and unlock tests passed. Hosted browser storage, permissions and recovery verification pending. |
| Revisions, report library, full print/PDF | `app/record-credibility.tsx`, `app/report-library.tsx`, `app/daily-log.css`, `app/api/report-library/route.ts` | Original components and styles bundled. Revision data and full browser print verification pending. |

First complete the Daily Log. The requested sequence then continues with
Scheduling, Payroll, Inventory and Apparatus Checks, Drug Checks, Air Packs,
Respond, Personal, Box Card, Safety Checks, Live Ops Board, and Command
Board. Review the Box Card dependency before Respond implementation.
The Respond API already looks up active box cards and the Respond screen
opens matching cards. Later work belongs in the same application.
