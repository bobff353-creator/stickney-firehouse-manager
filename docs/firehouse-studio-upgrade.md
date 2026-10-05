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

### Phase 6 implementation batch

Five related improvements build on the existing CAD adapters and response maps:

1. Response opens the selected incident in Command Board for authorized viewers.
   A cleared/missing selection does not silently switch to another call. Active
   CIS incidents retain the same age rules as Response.
2. Command saves use transactional revision and active-incident guards, keeping
   the board and its audit event together during concurrent edits or closeout.
3. A save request has a department/account scoped receipt. Lost-response retries
   cannot repeat an event; a receipt-only check never sends an unsaved change.
4. One ordinary command update can be retained as an explicit local draft on the
   current tab. Reconnect, refresh, review and send manually. Conflicts, an old
   device clock, or a different incident block sending and retain a downloadable
   draft. Mayday, PAR, search confirmations, benchmarks and closeout require live
   updates. The shared board does not show unconfirmed draft assignments.
5. CAD receipt age is labeled separately from upstream connection verification,
   with Central times and interrupted-update recovery. Dispatch note and command
   timestamps also handle legacy UTC storage correctly. An expired PAR remains
   due after state normalization instead of resetting to a full interval.

No database migration or vendor configuration change is required. Local practice
fixtures use fictional records only. Existing tenant-scoped response maps, preplan
and hydrant references, email ingestion and CIS adapters remain in place.

Offline limits: the board must first load in an authenticated, connected tab;
there is no offline cold start. One pending ordinary action is retained per tab
and account/department scope. Storage failure falls back to the current page and
download. Drafts are not automatically replayed or rebased over a newer board.
Vendor/Cicero delivery acceptance, vehicle hardware feeds and mutual-aid sharing
still need their approved connections and real end-to-end acceptance; this batch
does not certify those external integrations.

Validate each batch with types, changed-file lint, relevant tests, production build
and browser checks. Push approximately four or five completed changes together.
Report source, push, migrations, deployment and live acceptance separately.

### Phase 5 implementation batch

Five related changes connect prevention to the existing canonical property IDs:
property inspection history (including archived visits and separate test filters),
field observations captured in the versioned inspection, reviewed updates to
selected preplan building summary fields, a tab-scoped pending inspection queue,
and nearby hydrant references from saved coordinates. The private inspection
pilot stays restricted to its designated owner; the reverse preplan shortcut is
shown only with that existing pilot grant. No additional address database,
production fixture records, notification sends or schema migration is introduced.

Applying observations checks preplan edit permission, the source inspection
version and destination update timestamp. The source guard, selected field update
and immutable receipt (previous/applied values and actor) commit together. Test
inspections cannot alter operational preplans. Empty fields cannot erase data;
photos, mapped features, construction, contact records and publication history
remain in their existing workflows. Building summary edits can be immediately
visible; advanced publication is still separate.

Offline coverage is an incremental field workflow: load the workspace while
connected, continue entering observations, and choose Save on this tab for later.
Pending entries survive reload in that tab and require explicit synchronization
through the authenticated API. A conflict retains local work and requires review;
an entry older than 24 hours also requires review. Download pending entries for
retention beyond the tab's lifetime. This does not implement offline cold-start,
cross-device queues, offline files/email, or background preplan publication.
Hydrant distances are approximate straight-line references, not access routes or
inferred water-flow adequacy. Phase 6 remains the response/command upgrade.

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

Authenticated acceptance confirmed the real saved crew, due checks, apparatus
service status, current call and existing handoff/payroll review counts. It also
identified the portal's forced dark shell, which is independent of operating
system preference. A grouped presentation correction aligns the TODAY heading,
primary navigation, crew/readiness panels and Inbox status/filter controls with
that shell. Repeat visual acceptance includes the actual shell styles rather
than only global CSS in the isolated fixture.

## Phase 2 release

Five related changes are grouped into one push:

1. The Operations due screen joins saved checks, active assets, work orders and
   supply attention, with direct links to the existing tools. Existing check
   templates, unfinished results, reports, photographs and linked IDs remain.
2. Equipment attention combines open repairs/defects, saved service status,
   expiration dates, hydro dates and service reminders. Missing bottle hydro
   dates and invalid service schedules require verification. Retired assets are
   excluded; dates alone do not certify readiness.
3. Repair notices and work orders save transactionally. Closing work preserves
   service status; a separate equipment release remains necessary. An exception
   shared by another open order stays unresolved. Stale stage changes are denied.
4. Stock movements lock the actual lot and save its audit in the same transaction.
   Overdraw is rejected instead of silently clamped. Physical quantities retain
   every lot; reorder attention excludes expired stock and stock with missing
   required dates. Restock requests still require an actual receipt to add stock.
5. Board setup offers Station briefing and Operations readiness templates. The
   readiness packet contains department-scoped aggregate counts, no narratives,
   assignee names or costs. Existing call takeover, sound opt-in, required-check
   section, announcements and weighted rotation remain. Failed reads retain a
   marked last report; denied access clears the packet.

The additive migration `20261005151249_inventory_phase_two_safe_operations.sql`
adds caller-owned, department-scoped save receipts and a security-invoker RPC.
RLS, the signed portal server boundary and action-specific permission checks are
retained. Unknown-response retries use the same request UUID, including a page
reload; the browser stores only a digest and UUID. Successful saves clear the
pending reference. No operational rows are seeded or backfilled.

181 focused inventory, board, session and fleet tests passed. Real local
PostgreSQL fixtures verified atomic rollback, repeat-safe stock/repair saves,
audit persistence, retained defects, completed-record protection, caller RLS and
denied server/department access. Actual handler tests verified scoped paging past
1,000 assets, redacted TV fields and failure responses. Phone, tablet, desktop,
light/dark and unavailable-feed browser previews use isolated fictional data.
Changed-file lint and type checks pass; production build, migration deployment
and authenticated live acceptance are recorded independently for the release.

The board fixture now supplies the department context required by the production
SQL adapter. Legacy source assertions were updated for transactional repair RPCs
and safe-retry messaging; rollback/permission behavior is covered by SQL and real
handler tests. This focused suite does not establish that every repository test
outside this release passes.

Four follow-through changes form a second grouped push: current briefing equipment
reports stay visible in the readiness template, new stock records save together
with their initial lot/audit, restock request/approval/fulfillment uses locked
transactional saves, and physical movements support whole quantities and new lots
under the existing supply ID. Fulfillment changes only request status; a physical
receipt must be recorded separately. Missing required new-lot expiration dates,
overdraw, unauthorized setup and stale request stages are rejected.

`20261005154554_inventory_stock_setup_and_restock_atomic.sql` extends the same
caller/RLS/receipt boundary without rewriting records or granting new roles.
186 focused tests pass after this batch, including rollback of failed initial
stock/lot audits, stable older lot IDs and dates, replay-safe restock transitions
and no automatic stock credit. Browser fixtures exercised bulk and new-lot form
payloads and preserved equipment reports without writing live department rows.
Types, changed-file lint and the production build passed. The first push is
`2de021b470091d7d021876c1bf2896fda1702825`; the authenticated production overview
confirmed 1,629 active assets and the same 16 unfinished checks as the saved
inventory workspace. These are dated acceptance observations, not fixed targets.

## Phase 3 release

Five related scheduling, timekeeping and payroll improvements form one push:

1. Shift Builder starts drafts from 24/48, 24/72, 24/96 or daily 24-hour rotations.
   A preset does not save or assign anyone. The 48/96 guidance uses two existing
   24-hour patterns; Kelly days and leave retain dated changes.
2. Schedule review checks saved assignment IDs for overlaps, invalid times and
   current qualification mismatches. Date/type filters and day links support
   follow-up in the existing staffing editor.
3. Department administrators can save advisory minimum-rest and maximum-continuous
   clock-hour rules. Both are unset by default. Rules and audit save atomically
   in existing department-scoped metadata; stale saves conflict, and failed saves
   retain the draft. This does not enforce union rules, change assignments or
   calculate elapsed daylight-saving hours for pay. No migration is needed.
4. Timekeeping review compares Daily Log attendance with recorded duty-pay hours,
   identifies adjacent-date overlaps across period boundaries and links each flag
   to the existing timesheet. Manual differences can be legitimate. Review changes
   no hours, approval, submission or historical record.
5. A formula-safe review CSV includes all flags. Working payroll downloads read
   current saved records and reject unsaved edits, invalid source mappings/hours,
   unavailable reads or inconsistent totals. Submitted exports retain their frozen
   document and approved adjustments rather than substitute newer working data.

176 focused payroll, scheduler, availability, department-schedule and SQL/API
regression tests passed, followed by six additional actual export-handler/source
validation tests and a repeat of the 12 new review-model tests. PostgreSQL tests
verify atomic rule/audit rollback, concurrent-save conflicts, permission denial,
department keys and unchanged no-op revisions. Browser fixtures exercised the
actual panels at phone/tablet/desktop sizes, light/dark themes, failed-save recovery,
conflicting drafts, links, filters and draft-only rotation presets. Fixtures are
local and fictional; no department attendance or payroll rows were seeded.

Type checks, changed-file lint and the final production build are tracked in the
release logs. Lint retains one existing unused `OvertimeScreen` warning. Production
deployment and authenticated live acceptance are verified independently. This
batch extends the existing scheduling/submission system; it does not establish
that every envisioned commercial scheduling feature or external payroll
integration is complete. Phases 4-7 remain separate work.

## Phase 4 release

Five related training and document changes form one push:

1. Saved pilot assignments can carry a repeat interval in calendar days. Create
   next occurrence explicitly saves a separate assignment, with empty attendance
   and answers. Repeated requests return the same occurrence without overwriting
   edits or restoring an archived child. No completion credit is created.
2. Credentials retain issuing authority and a recorded renewal period. A searchable
   renewal register filters recorded dates by 7/30/60/90-day windows. Missing dates
   remain visible. The renewal period never extends a recorded date or determines
   certification or duty eligibility.
3. Training references have document types, effective dates and links. The existing
   private file center adds filename/linked-record search. Original PDF/photo
   evidence remains private and separate from notes. Department policies gain
   document type and HTTPS reference filters; these references do not import files.
4. Policy edits save as drafts. Publication appends a frozen content version;
   archive/restore retains text, versions and receipts. The first edit preserves
   existing legacy content without inventing a publication date. Older action-only
   audit entries cannot reconstruct previously overwritten text.
5. A published version can require acknowledgement from the active roster captured
   at publication. Each receipt uses the verified member identity and exact version.
   A new required version needs a separate receipt. Managers can review current and
   historical receipt reports; member responses omit other members' reports.

Training remains the existing Bob-only pilot. Policy management and member reads
retain existing permissions and tenant routing. No email/push, OSFM submission,
certification award, database migration or new storage grant is part of this batch.
Draft/version/receipt keys use existing department-scoped metadata. Atomic batches
retain document audit and saved state together, with stale-edit rejection and
repeat-safe acknowledgements. Literal prefixes prevent wildcard IDs from reading
another document's history.

Focused PostgreSQL/API tests cover failed-audit rollback, conflicts, concurrent
retries, immutable historical text/receipts, hidden drafts/archives, verified own
identity, department scoping and unchanged training credit. Training import and
private-pilot fixtures now supply the department context required by the existing
SQL adapter; this changes fixtures rather than production access. Local fictional
browser verification exercises draft recovery, publication, member receipt,
recurrence, renewal filters and document filters at phone/tablet/desktop sizes.
No fictional operational rows or live policy revisions are seeded for acceptance.
Production health and signed-in read-only checks are recorded separately after
deployment. This is a practical Phase 4 batch, not a claim that every commercial
course-delivery or general document-upload feature is complete. Phases 5-7 remain.

Live acceptance found that the production bento workspace overrode Training's
paper-surface typography. A grouped follow-up corrects heading/record names,
body/review text, form labels/native options, and action/status contrast. The
local fixture now includes the actual bento stylesheet and workspace classes so
phone/tablet/desktop acceptance reproduces that production shell.

## Phase 7 release

Five related reporting and integration-readiness changes form one push:

1. The private NERIS reporting desk reconciles up to 1,000 saved CAD calls by exact
   source ID. Active operational drafts/reviews, multiple reports, archived links
   and test links are distinguished. Manual Daily Log calls and unlinked reports
   are outside this desk; absence here is not a no-activity finding. Nothing is
   automatically created, merged, archived, deleted or submitted.
2. Download saved review packet uses the authorized server record and expected
   saved version. It rejects stale versions and changes during export. Packets
   include pinned-schema provenance, local validation findings, source ID and
   current private attachment metadata. File bytes and storage keys are excluded;
   attachment downloads still need an authorized session. Client draft downloads
   remain separate. Local review never means official validation or acceptance.
3. Command Center gates Daily Log and payroll sources independently on the server.
   Officers without payroll.manage receive no employee payroll details, settings,
   rates or fiscal cost. Restricted/unavailable sources are labelled, including
   in exports. A failed source leaves other authorized metrics usable. Payroll
   calculations include full pay periods at the history boundary. Charts show
   twelve consecutive calendar periods, and missing times are excluded from
   time-of-day bars rather than assigned to midnight.
4. A date-filtered chief report provides defined totals, source links, a CSV
   download and a focused print view. Dates stay within the loaded history;
   formulas in CSV cells are neutralized. Staffing uses the existing four-seat,
   three-shift model. Equipment totals are observations, not unique repair tickets;
   payroll is calculated gross pay, not proof of payment. Unmeasured metrics are
   named rather than given invented totals or readiness scores.
5. Firehouse Connect separates app credential configuration, saved CIS receipt
   history and unverified vendor delivery. NERIS submission remains unconnected,
   and AI assistance is not enabled. This batch makes no outgoing vendor, NERIS,
   email, push or AI request and adds no credentials or access grants.

NERIS retains the Bob-only pilot boundary; analytics retains verified department
routing and existing assignable permissions. No database migration or fictional
production seed is needed. PostgreSQL/API checks cover redaction, denied exports,
partial failures, period boundaries, exact-version packets, private metadata,
department scoping and bounded reconciliation. Browser fixtures are explicitly
fictional and saving is disabled. Production deployment, health revision and
signed-in read-only acceptance are verified separately after publication.

This is the final planned upgrade batch. External vendor enrollment, approved
adapters, end-to-end receipts, additional source-specific analytics and optional
permission-aware AI remain follow-on capabilities, not completed connections.
