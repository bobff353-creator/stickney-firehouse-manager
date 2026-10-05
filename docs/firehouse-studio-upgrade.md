# Firehouse Studio architecture audit and roadmap

Audited October 5, 2026. Source baseline: `2b21424a52ca`, verified against
the Stickney production `/api/health`. Project: `prj_RTtTvD39FwyEGUovkPg8wxrdJCtF`.

## 1. Current architecture

Next.js 16 App Router, React 19, TypeScript, Vercel, Supabase Postgres/Auth/Storage.
`proxy.ts` verifies authentication, PIN confirmation, department membership and
same-origin writes. `server-permissions.ts` resolves rank grants and individual
exceptions. `payroll-app.tsx` owns the authenticated shell and URL-based workspaces.
Inventory also has a dedicated `/inventory` entry point. Modules use lazy imports.
The legacy SQL interface in `db/postgres-adapter.ts` translates existing queries
to department-scoped Postgres operations. Newer modules use session-bound clients.

## 2. Existing feature inventory

- Daily Log: schedule-derived staffing, officer sign-in/out, calls, callbacks,
  notes, saved history, revisions and payroll synchronization.
- Scheduling: station calendars, shift types/slots, availability, requests,
  trades, reminders and work details. Payroll: rates/rules, timecards, corrections,
  review/finalization and own-timesheet access.
- Operations: fleet profiles, equipment, inspection templates/schedules,
  checks and evidence, repairs, inventory, apparatus photos/locations and reports.
- Field: properties/preplans, hydrants, floor/photo annotations, published sharing,
  road closures, Respond, CAD adapters, dispatch persistence and incident command.
- Training, fire inspections and NERIS have explicit private-pilot boundaries.
- Policies, box cards, contacts, duties, activity history, board notes/feeds,
  TV operations, system health, department directory and permission editors exist.

This is a source inventory, not a claim that every integration is connected or
that every historical feature has been retested live in this audit.

## 3. UX findings

The starting menu has seven featured destinations; phone navigation has a
different set. Crew staffing is hidden behind an expandable briefing. Home waits
for payroll even for an ordinary shift visit. Attention items are distributed
across screens. Search already supports Ctrl/Cmd+K but lacks action vocabulary.
Existing saved-work and navigation recovery controls must remain in use.
Light/dark styling is distributed across several large CSS files; scope new
components to avoid overriding unrelated workspaces. Check narrow touch layouts.

## 4. Data-model findings

Person IDs already connect schedule, payroll and log records. Fleet IDs connect
profiles, checks, issues and equipment. Preserve these relationships. Dashboard
uses a hard-coded apparatus list and a staffing target of four; those are legacy
assumptions, not a configurable Shift Engine. Shift periods are also fixed at
06:00/noon/18:00. Do not infer a named/color rotation from these periods.
Daily-log equipment snapshots and fleet exceptions coexist; distinguish their
sources. Dashboard GET currently repairs dispatch projections and ensures a log
header; moving this to an idempotent background writer requires separate work.
Do not create a second personnel, apparatus or address database for TODAY.

## 5. Security findings

Keep server-side authorization and RLS, never client filtering alone. New TODAY
projections must redact module-specific information before serialization and
report missing/failed sources explicitly. Search shortcuts must use verified
grants, including when payroll has not loaded. Do not copy live records into test
departments. Pilot grants are separate from the general permission catalog.
Existing owner recovery access and session generation controls need preservation.
This review is not a penetration test or compliance certification. Review existing
security-definer grants, storage/RLS policies and backup recovery independently.

## 6. Recommended architecture

Keep the current application; introduce small typed projections over canonical
entities. TODAY consumes a permission-scoped shift packet. A pure Shift Overview
model derives attention and readiness without creating operational rows. Extend
that model with independently verified sources over subsequent batches. Use
stable source IDs for links and future events; changes remain in their originating
workflow. A future transactional event/outbox layer should connect failed checks,
repairs, training attendance and notifications with idempotency keys and audit
events. Keep vendor adapters in Firehouse Connect, outside UI components.

## 7. Recommended navigation

TODAY, RESPONSE, OPERATIONS, SCHEDULE, MORE. Retain legacy URLs/bookmarks.
More retains all permitted tools and administrative configuration. Operators
should reach their existing log/check/response workflow directly from TODAY.

## 8. Component/design-system plan

Reuse existing task navigation, unsaved-work guards, dialogs and status semantics.
Add a scoped Today layout, persistent primary navigation, crew list, source-status
cards and severity-filtered Inbox. Use text with status colors, 44px or larger
controls, semantic headings and explicit stale/error recovery. Extend the existing
keyboard search with permission-aware task shortcuts, without automatic writes.

## 9. Migration plan

The first batch requires no database migration. Later introduce additive
department shift configuration (time zone, handover time, period labels and
staffing requirements), reference existing schedule patterns, and backfill only
reviewed settings. Test Chicago midnight/DST boundaries and tenant isolation.
Preserve historical period definitions; do not reinterpret saved logs. Later
event/outbox and policy versioning tables need reversible migrations, caller RLS,
foreign keys and production acceptance before any destructive cleanup.

## 10. Prioritized roadmap and release batches

First batch (five related changes, one push):
1. Shared crew navigation and retained More tools.
2. TODAY independent of payroll, with visible crew and current log period.
3. Firehouse Inbox for known checks, defects, staffing and authorized handoffs.
4. Explainable readiness components with unknown/stale source states.
5. Ctrl/Cmd+K task vocabulary and verified-permission filtering.

Remaining Phase 1: configurable Shift Engine, real apparatus assignments and
shift duties/events, wider permission-scoped search, personnel role templates,
and reusable audited activity projections into Daily Log. Do not claim these
complete from the first batch.

Phase 2: complete checks/assets/work-order/inventory flow and TV templates.
Phase 3: rotation/qualification/fatigue rules, timekeeping and payroll exports.
Phase 4: training/credentials and policy version acknowledgements.
Phase 5: shared inspection/preplan properties and field offline workflow.
Phase 6: verified CAD adapters, response maps and command offline synchronization.
Phase 7: NERIS submission, reusable analytics, authorized optional AI and adapters.

Validate each batch with types, changed-file lint, relevant tests, production build
and browser checks. Push approximately four or five completed changes together.
Report source, push, migrations, deployment and live acceptance separately.

## First-batch validation

The production build and 91 focused tests passed, covering the actual TODAY
route, permission redaction, tenant-scoped fleet queries, readiness unknown/stale
states, legacy navigation, scheduling and the existing security boundaries.
Changed-file lint and whitespace checks passed. Isolated, explicitly fictional
browser fixtures exercised desktop, phone and tablet layouts, light/dark CSS,
priority filtering, safe navigation and unavailable/stale data without inserting
department records.

The full regression run is not green: legacy fixture failures remain. A board
fixture's missing department-portal dependency was reproduced against the
unchanged production revision. The full run was stopped after the successful
build rather than reporting its partial results as passing. Production release
and authenticated live acceptance are verified separately after the batch push.
