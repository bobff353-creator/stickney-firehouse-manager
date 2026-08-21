# Operational Preplan 2.0 acceptance ledger

This ledger maps the required acceptance scenarios to current evidence. Automated source and domain tests do not replace signed-in use against an isolated preview database and private test storage. No scenario is marked complete until every manual item in its row has been observed and recorded.

| Scenario | Automated evidence | Isolated preview evidence still required | Status |
| --- | --- | --- | --- |
| A — School fire | Levels, room aliases, conservative CAD room matching, suggested level, room highlight, critical-alert priority, and return-to-Arrival behavior | Author a school record with two floors, two stairs, systems, and a private second-floor plan; publish it; inject approved test CAD narrative; verify phone, iPad, and desktop Respond behavior | Automated contracts pass; manual acceptance outstanding |
| B — Chlorine hazard | HazMat validation, pinned ERG source boundary, mapped/unmapped zones, level filtering, structured Respond fields, and private SDS route | Save verified chlorine/UN 1017 values without guessed distances; upload and stream a test SDS; publish; render approved isolation and evacuation geometry | Automated contracts pass; manual acceptance outstanding |
| C — Temporary road closure | Effective/expiration state, require-verification behavior, expiring queue actions, audit contract, and no automatic deletion | Create controlled active and expired records; verify Arrival/IAP visibility and authorized extend, resolve, and archive actions at controlled times | Automated contracts pass; manual acceptance outstanding |
| D — Hose lay | Segment totals, reserve and section rounding, independent supply options, verified capacity comparison, deficit, and unverified-not-zero behavior | Draw the approved multi-segment route from a test hydrant, reload it, publish it, and compare against a verified test apparatus inventory | Automated contracts pass; manual acceptance outstanding |
| E — Target hazard | Explainable factor scoring, override validation, published Respond banner, and readable reasons | Save the three approved factors, exercise authorized override/review, publish, and visually verify the High Target Hazard presentation | Automated contracts pass; manual acceptance outstanding |
| F — Draft and publication | Draft ownership, unauthorized concealment, reviewer/publisher transitions, immutable snapshots, Respond published-only selection, and restore-as-new-revision | Exercise distinct firefighter, reviewer, publisher, administrator, employee-allow, and employee-deny sessions against isolated data | Automated contracts pass; administrator publication/search evidence recorded; role matrix outstanding |
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

## Release decision

The focused gate is `npm run verify:preplan-v2`. It runs scoped lint, a production build, and the focused Operational Preplan/Respond test suite. The repository-wide `npm run lint` remains a separate whole-portal check; failures outside the Preplan scope must be reported rather than hidden.

Production promotion requires explicit authorization plus completed manual evidence for all seven scenarios, the role matrix, private upload/stream/denial/cleanup, offline cache/reconnect/sign-out clearing, responsive viewports, accessibility inspection, migration backup, and rollback readiness.
