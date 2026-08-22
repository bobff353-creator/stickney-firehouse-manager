# Operational Preplan 2.0 acceptance ledger

This ledger maps the required acceptance scenarios to current evidence. Automated source and domain tests do not replace signed-in use against an isolated preview database and private test storage. No scenario is marked complete until every manual item in its row has been observed and recorded.

| Scenario | Automated evidence | Isolated preview evidence still required | Status |
| --- | --- | --- | --- |
| A — School fire | Levels, room aliases, conservative CAD room matching, suggested level, room highlight, critical-alert priority, and return-to-Arrival behavior | Author a school record with two floors, two stairs, systems, and a private second-floor plan; publish it; inject approved test CAD narrative; verify phone, iPad, and desktop Respond behavior | Automated contracts pass; manual acceptance outstanding |
| B — Chlorine hazard | HazMat validation, pinned ERG source boundary, mapped/unmapped zones, level filtering, structured Respond fields, and private SDS route | Save verified chlorine/UN 1017 values without guessed distances; upload and stream a test SDS; publish; render approved isolation and evacuation geometry | Automated contracts pass; manual acceptance outstanding |
| C — Temporary road closure | Effective/expiration state, require-verification behavior, expiring queue actions, audit contract, and no automatic deletion | Completed on the isolated preview with controlled active/expired alerts and a temporary Incident Action Plan layer | Complete on isolated preview |
| D — Hose lay | Segment totals, reserve and section rounding, independent supply options, verified capacity comparison, deficit, and unverified-not-zero behavior | Draw the approved multi-segment route from a test hydrant, reload it, publish it, and compare against a verified test apparatus inventory | Automated contracts pass; manual acceptance outstanding |
| E — Target hazard | Explainable factor scoring, override validation, published Respond banner, and readable reasons | Save the three approved factors, exercise authorized override/review, publish, and visually verify the High Target Hazard presentation | Automated contracts pass; manual acceptance outstanding |
| F — Draft and publication | Draft ownership, unauthorized concealment, reviewer/publisher transitions, immutable snapshots, Respond published-only selection, and restore-as-new-revision | Completed against the isolated preview with the administrator and real edit-deny account | Complete on isolated preview |
| G — Legacy preplan | Idempotent Arrival backfill, feature/photo relationship preservation, legacy publication, bootstrap marker separation, and legacy Respond contracts | Open a copied or approved legacy record and verify its original contacts, footprint, features, A–D photos, fire-flow data, and Respond visibility before and after migration | Automated contracts pass; manual acceptance outstanding |

## Evidence record

For each manual run, record the date, tester, branch and commit, Vercel deployment ID, isolated database/storage identifier, browser and viewport, test record IDs, observed result, screenshots, console errors, and cleanup result. Do not place secrets, signed asset URLs, or protected record content in the evidence.

### 2026-08-21 — Administrator publication and Respond search

- Tester: signed-in `User Preview Verification` administrator.
- Branch and commit: `codex/preplan-operational-v2-approved` at `ff3de16`.
- Deployment: `dpl_CbmTLhN2qcRkETVP5CBwqAwSCsxT`; protected stable preview alias.
- Isolated database: Supabase project `pzgvlslcaoqtrnaqyjmd`; no production database or storage used.
- Browser evidence: protected side-browser preview at 1093×600.
- Test record: `preview-ui-verification`, visibly labeled `PREVIEW ONLY - Operational Preplan Verification` with no production address.
- Observed result: administrator PIN sign-in succeeded; `IN_REVIEW` published to `PUBLISHED`; UI displayed live published revision 2; Respond loaded its truthful no-active-call state and its Search preplans action opened the published test record.
- Database confirmation: read-only query returned `publication_status=published`, `revision_number=2`, and one immutable revision snapshot.
- Console evidence: not available because automated browser control was unavailable; no console-error claim is made.
- Cleanup: the approved preview fixture remains published at revision 2 for subsequent isolated acceptance work. No fake CAD incident, production record, upload, or destructive action was created.

### 2026-08-21 — Signed-in role and override matrix

- Tester: six clearly labeled preview-only employees plus the existing `User Preview Verification` administrator.
- Branch and commit: `codex/preplan-operational-v2-approved` at `6d737c8`.
- Deployment: `dpl_JEAWRXDBVehLM9mJq8FpiETFFTwJ`; protected stable preview alias.
- Isolated database: Supabase project `pzgvlslcaoqtrnaqyjmd`; production accounts, records, storage, and environment variables were not used or changed.
- Sessions exercised: distinct firefighter, editor, lieutenant reviewer, publisher allow-override, member edit allow-override, firefighter edit deny-override, and administrator identities. Every non-admin identity was activated through the real roster activation flow without sending email.
- Observed result: firefighter/editor and edit-allow sessions could edit ordinary response data but had no publication actions; reviewer could return a published record to draft and edit risk factors but could not publish or archive; publisher could publish/archive but not review risk factors; edit-deny could read the published fixture but had no Edit Preplan, publication workflow, or operational-data controls; administrator had all tested controls.
- Authorization correction: the live operational API now returns only the signed-in member's effective Preplan permissions, and the panel hides controls that the server would reject. The server-side permission checks remain authoritative.
- Preview repair: the isolated legacy branch received the repository-equivalent activation-attempt table/function compatibility layer and its own verified Supabase admin credential. The portal now accepts either a new `sb_secret_` server key or a JWT whose decoded role is exactly `service_role`; the key stays server-only.
- Cleanup: all matrix sessions were signed out. The labeled preview-only identities remain active for the remaining controlled acceptance scenarios; no department email was sent and no production state changed.

### 2026-08-21 — Private attachment upload, stream, denial, and cleanup

- Tester: a temporary, clearly labeled preview-only administrator created solely for this acceptance run; no established role-matrix account was changed.
- Branch and commit: `codex/preplan-operational-v2-approved` at `0fc908b`.
- Deployment: `dpl_7eS88kVatFrFHDKwoehj4FH8km6S`; immutable preview URL `stickney-firehouse-manager-eipt91ux2-fire-pre-plan-pro.vercel.app` and protected stable preview alias.
- Isolated services: Supabase project `pzgvlslcaoqtrnaqyjmd` and its private `firehouse-portal` bucket; production database, accounts, and storage were not used.
- Test record and file: `preview-ui-verification`; repository PNG uploaded with caption `PREVIEW ONLY attachment acceptance`.
- Observed result: authenticated upload returned 200; authenticated stream returned 200 with `image/png`, `Cache-Control: private, no-store`, and `X-Content-Type-Options: nosniff`; the same stream without an application session returned 401; authenticated deletion returned 200; the deleted route returned 404.
- Correction verified: private storage now rebuilds uploaded streams as a Blob with the route-accepted MIME type instead of silently changing them to `application/octet-stream`.
- Cleanup audit: temporary auth users, employee profiles, employee rows, pay-scale rows, attachment metadata rows, and matching storage objects all returned zero after cleanup. No acceptance attachment or temporary identity remains.

### 2026-08-21 — Respond packet fallback, reconnect, and sign-out clearing

- Tester: signed-in `Preview Matrix, Firefighter` preview-only identity; no production account was used.
- Branch and commit: `codex/preplan-operational-v2-approved` at `a442d93`.
- Deployment: `dpl_8UoPFKnDwWKjMstj3BRqbfjeizFq`; immutable preview URL `stickney-firehouse-manager-fa7bgi53j-fire-pre-plan-pro.vercel.app` and protected stable preview alias.
- Isolated fixture: dispatch `PREVIEW-OFFLINE-ACCEPTANCE`, visibly labeled `PREVIEW ONLY CACHE TEST`, matched the published `preview-ui-verification` record by its non-production address.
- Live packet: Respond displayed the active call, published revision 2, truthful unknown values, and the preview-only CAD note before caching the department-scoped packet.
- Controlled failure and reconnect: a temporary `field_preplans.view` deny override made the real Respond API reject this preview account. Respond retained the matched packet behind the timestamped `OFFLINE — READ-ONLY PREPLAN` warning and limitations. Removing the override returned the same mounted view to live status on its next refresh.
- Sign-out correction: sign-out now explicitly clears private Respond packets before locally ending the Supabase session; server PIN-cookie cleanup no longer blocks the signed-out UI. The deployed browser reached the explicit `Signed out.` state.
- Cleanup audit: the preview dispatch and temporary permission override both returned zero, and the test account was signed out. Production remained unchanged.
- Browser limitation: the available browser controller could not toggle its network adapter, so this run exercised the identical fetch-failure/cache-fallback path with a server authorization denial. A literal device-network-offline toggle remains required before production promotion.

### 2026-08-21 — Responsive and keyboard accessibility matrix

- Tester: signed-in `Preview Matrix, Firefighter` preview-only identity.
- Branch and commit: `codex/preplan-operational-v2-approved` at `9769c74`.
- Deployment: `dpl_5L3csNA15xJhhWAXzTPmpcM48vbr`; immutable preview URL `stickney-firehouse-manager-2s6s7ygqq-fire-pre-plan-pro.vercel.app` and protected stable preview alias.
- Isolated fixture: dispatch `PREVIEW-RESPONSIVE-ACCEPTANCE`, visibly labeled `PREVIEW ONLY RESPONSIVE TEST`, matched the non-production `preview-ui-verification` record.
- Viewports observed: 390×844 phone, 820×1180 iPad, 1440×900 desktop, and 1920×1080 apparatus/fullscreen-sized viewport. Every viewport retained the active-call heading, published revision 2, level switcher, quick intelligence, map fallback, tactical tabs, and truthful unavailable states without horizontal document overflow.
- Touch targets: all visible Respond buttons, tabs, and links met the 44 px minimum after correcting the empty-media Google Maps link from 42 px to 44 px. The deployed iPad-width remeasurement returned 44×279 px.
- Keyboard behavior: Arrow Right moved both focus and selection from `CAD Notes` to `Floor Plan`; `End` moved focus to `D Side`; the selected tab retained `aria-selected=true` and `tabindex=0` while inactive tabs used `tabindex=-1`.
- Console: no warning or error entries were captured during the phone, iPad, desktop, apparatus, keyboard, or deployed-correction checks.
- Automated support: reduced-motion, safe-area, focus-restoration, screen-reader footprint alternative, responsive matrix, and overflow contracts pass in the repository suite. Formal instrumented color-contrast analysis remains required before production promotion.
- Cleanup audit: both responsive/offline acceptance dispatch IDs and matching Daily Log call rows returned zero. Production remained unchanged.

### 2026-08-21 — Isolated migration inventory and backup readiness

- Target confirmation: verified `codex/preplan-operational-v2-approved` at `65ba8f3`, origin `bobff353-creator/stickney-firehouse-manager`, Vercel project `prj_RTtTvD39FwyEGUovkPg8wxrdJCtF`, and isolated Supabase preview project `pzgvlslcaoqtrnaqyjmd`.
- Current tooling: Supabase CLI `2.115.0`; the current Supabase changelog contains no breaking change that alters this logical-backup procedure.
- Exact preview inventory: one preplan, one level, one revision, six reviews, and one settings row. Alerts, annotations, assets, feature-level links, HazMat records and zones, hose lays, photo annotations, risk factors, and spaces each contain zero rows.
- Backup attempt: `supabase db dump --linked --project-ref pzgvlslcaoqtrnaqyjmd --schema firehouse` was attempted against the isolated preview only. The CLI stopped before producing content because Docker Desktop is unavailable, and no standalone `pg_dump` client is installed. The empty partial output was removed.
- Readiness decision: exact row-count inventory is complete, but a restorable logical backup and restore rehearsal are not complete. Production backup, storage inventory, migration, restore, and promotion were not attempted.
- Rollback boundary: application rollback remains the first response for an application-only failure. The additive database tables must not be dropped during incident response; a production change window still requires a fresh approved backup and preservation of newer records for reconciliation.

### 2026-08-21 — Instrumented color-contrast verification

- Tester: signed-in `Preview Matrix, Firefighter` preview-only identity on the protected stable preview alias; production accounts and data were not used.
- Corrections: login-card labels, light Preplan record labels and empty states, dark Operational Preplan revision/expiration content, portal sync/search/footer labels, and Respond idle/empty text received explicit AA palettes with source regression assertions.
- Deployments: login correction `dpl_7KPuGvqj6FMA6JeCc2TJwXMxmEKU`; signed-in Preplan correction `dpl_Ge4NpgPExFrz2esYGMUxGCfpu8R7`; final Respond correction `dpl_FJ2gAVqRmmAVPksJscmZDL6oWdWL`.
- Deployed measurements: login labels 6.66:1 and 5.40:1; Operational Preplan revision/expiration headings 15.27:1 and supporting text 11.11:1; light Preplan labels/empty states at least 5.10:1; Respond idle/empty text at least 5.11:1. Each measured normal-text pair exceeds the WCAG AA 4.5:1 threshold.
- Validation: focused contrast/auth/Respond tests, repository lint, production build, and `git diff --check` passed before the final CSS-only Respond correction; the final correction then passed its focused tests, repository lint, and deployed measurement.
- Separate console finding: Google Maps reported `InvalidKeyMapError`/`InvalidKey` on the preview. This is an unresolved map-key configuration issue, not a color-contrast failure; no clean-console claim is made for this run.

### 2026-08-21 — Protected-preview Google Maps verification

- Tester: signed-in `Preview Matrix, Firefighter` preview-only identity on the protected stable preview alias.
- Branch and commit: `codex/preplan-operational-v2-approved` at `0b49585`.
- Deployment: `dpl_84t6yqFcsxCopAGVeKEyiaXcftzM`; immutable preview URL `stickney-firehouse-manager-6g8pdbm3n-fire-pre-plan-pro.vercel.app` and protected stable preview alias.
- Configuration boundary: the valid browser key is stored as a sensitive Vercel Preview variable scoped only to `codex/preplan-operational-v2-approved`. The protected preview origin was added to the existing Google Maps browser-key website restrictions. Production Vercel variables and the production deployment were not changed.
- Observed result: the published `preview-ui-verification` record rendered Google satellite imagery, standard Google map controls and attribution, the preplan overlay, and the expected map position at zoom 20.
- Console result: no warning or error entries were present after the signed-in Field Preplans record and Google map finished loading. The earlier `InvalidKeyMapError` and `InvalidKey` warning did not recur.
- Secret handling: the key value was transferred directly from the system clipboard into the sensitive branch-scoped variable and was not printed, written to a repository file, or committed.

### 2026-08-21 — Draft concealment and lifecycle mutation

- Tester: real `Preview Matrix, Deny Override` and `User Preview Verification` preview-only identities; administrator test-view impersonation was not used as server-authorization evidence.
- Branch: `codex/preplan-operational-v2-approved`; protected stable preview alias and isolated Supabase project `pzgvlslcaoqtrnaqyjmd`.
- Test record: `preview-ui-verification`, visibly labeled `PREVIEW ONLY - Operational Preplan Verification` with no production address.
- Draft transition: the administrator returned published revision 2 to `DRAFT`. An ordinary firefighter with working-copy edit permission remained authorized as designed; the explicit `field_preplans.edit` deny-override account was then used for the concealment boundary.
- Concealment result: the signed-in edit-deny account's real Field Preplans request returned `0 preplans`; the test fixture was absent from the directory and map results. No administrator UI test mode or client-only permission simulation was counted as proof.
- Publication result: the administrator advanced the record through `DRAFT` to `IN_REVIEW` and then `PUBLISHED`. Publication created revision 3 and increased immutable revision history from one entry to two.
- Published visibility: after publication, the same real edit-deny account could open the test fixture again and saw `PREPLAN 2.0 · PUBLISHED` while edit and publication controls remained absent.
- Console and cleanup: no warning or error entries were captured during concealment, lifecycle transition, or post-publication verification. The fixture was left published at revision 3; production accounts, records, storage, environment variables, and deployment were not changed.

### 2026-08-21 — Temporary-alert expiration controls and review actions

- Tester: signed-in `User Preview Verification` administrator on the protected stable preview alias; isolated Supabase project `pzgvlslcaoqtrnaqyjmd` only.
- Branch and deployment: `codex/preplan-operational-v2-approved` at `869c347`; deployment `dpl_xjtLWQHmyVgzFQ9pLM88DgHSPURS` and protected stable preview alias.
- Defect found and corrected: automated entry into the `datetime-local` controls visibly changed the inputs but the React form submitted empty effective and expiration values. The controls now persist input events, and authorized reviewers can archive any active response alert without deleting its audit history.
- Controlled records: a clearly labeled active road-closure alert displayed `WARNING · EXPIRING` on Arrival with its 10:30 PM expiration; a clearly labeled expired closure entered the open Expiring Items queue as `EXPIRED`. No record claimed to be an actual department restriction.
- Authorized actions: the expired record was extended 30 days to September 20, then resolved; the remaining active record was archived through the queue. Read-only API evidence contained `expiration_extend_alert`, `expiration_resolve_alert`, and `expiration_archive_alert` audit actions.
- Cleanup: the three undated defect-reproduction alerts and both controlled dated alerts are archived, not deleted. The live panel returned to `Expiring items 0`, `No active response alerts are recorded`, and no visible `PREVIEW ONLY` alert. Archived audit rows remain intentionally in the isolated preview.
- Validation: the focused expiration and release-ledger tests pass; scoped Preplan lint passes; the production build compiled successfully. The first focused-gate run correctly exposed a stale ledger assertion after Scenario F was completed; that assertion was updated to the new evidence contract.
- Incident Action Plan visibility: on deployment `dpl_E4UgJaBaGPVSHeW2ndvwBaG5G1VF` from commit `bb7f60e`, a clearly labeled temporary IAP layer held a road-closure annotation that appeared on that layer and did not appear when Arrival was selected. The default Arrival level exposed no archive control.
- Layer cleanup: authorized archive controls retired the annotation first and then the non-default IAP layer. Server checks prevent archiving Arrival and reject a level archive while active child records remain. The active record returned to one `Arrival / Site` level, no tactical annotations, and no console errors; archived audit rows remain in the isolated preview.
- Scenario C result: controlled active/expired timing, Arrival/IAP visibility, extend, resolve, annotation archive, alert archive, and layer archive are verified. Scenario C is complete on the isolated preview.

### 2026-08-21 — Scenario D hose-lay persistence and cleanup

- Tester and scope: signed-in `User Preview Verification` administrator on the protected stable preview alias and isolated Supabase project `pzgvlslcaoqtrnaqyjmd`; production was not changed.
- Controlled data: a clearly labeled temporary preview hydrant and hose lay recorded three segments of 120, 85, and 40 feet. The editor computed 245 feet total and recommended 400 feet from 100-foot reserve and section values.
- Persistence: after reload, the saved source hydrant, segment distances, computed total, recommendation, supply-line context, and intentionally unverified apparatus state remained visible.
- Honest limitation: the preview contains no verified fleet apparatus. No apparatus record was fabricated, so apparatus-capacity comparison remains outstanding. The editor persists auditable segment distances but does not yet capture drawn route geometry; that requirement also remains outstanding.
- Cleanup and defect correction: the hose lay was archived. Temporary hydrant deletion exposed incompatible data-changing CTE and `DELETE ... RETURNING` query shapes in the portal RPC; commits `fe2950e` and `534b7e9` replaced them with portable existence checking and run-mode deletes.
- Deployed verification: deployment `dpl_HeRrwdtFaJ2Wzofvd9Lw6a5WNCBR` became Ready and served the protected alias. Retrying the already-confirmed cleanup reported `Hydrant deleted`; the directory returned to `1 preplans · 0 hydrants`, and the preplan returned to `HOSE LAYS 0` / `None calculated`, with both temporary names absent.
- Scenario D result: source selection, multi-segment distance persistence, total/recommendation calculation, reload, archive, and cleanup are verified. Scenario D remains partial pending drawn route geometry and verified apparatus-capacity comparison.

## Release decision

The focused gate is `npm run verify:preplan-v2`. It runs scoped lint, a production build, and the focused Operational Preplan/Respond test suite. The repository-wide `npm run lint` remains a separate whole-portal check; failures outside the Preplan scope must be reported rather than hidden.

Production promotion requires explicit authorization plus completed manual evidence for all seven scenarios, a literal device-network-offline check, a restorable migration backup, and rollback readiness. Scenarios C and F, the role matrix, private upload/stream/denial/cleanup, controlled Respond cache fallback/reconnect, sign-out clearing, responsive viewport, touch-target, keyboard, formal color-contrast, Google Maps, and isolated row-inventory gates are complete on the preview only. The logical backup and restore rehearsal remains blocked by the missing local dump runtime.
