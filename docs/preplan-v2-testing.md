# Operational Preplan 2.0 verification matrix

Automated checks cover lifecycle dates, hidden expiration behavior, level labels, plan coordinates, polygon area, hose sections/reserve/capacity, explainable hazard scores, fire-area controlling flow, conservative CAD room matching, ERG source pinning, private asset controls, normalized migration tables, legacy Arrival backfill, RLS, and route-to-migration column contracts.

Responsive guardrail tests preserve the required 360×800, 390×844, 768×1024, 1024×768, 1366×768, and 1920×1080 verification matrix. They enforce Respond overflow containment, reachable level navigation, safe-area padding, stacked phone controls, readable long values, and 44-pixel operational actions. These automated contracts supplement rather than replace the signed-in visual checks below.

Reduced-motion checks ensure the operating-system preference disables animations, transitions, and smooth scrolling while retaining Respond's ten-second data refresh, textual emergency labels, and offline warning state.

Respond's tactical footprint keeps its SVG visual layer out of the accessibility tree and exposes every mapped system through a visible, keyboard-operable text list with truthful empty and unknown states.

Lifecycle permission checks cover ordinary published viewing, editor/reviewer/publisher working access, creator ownership, employee allow/deny resolution through the existing permission service, filtered list responses, and denied direct operational URLs without revealing that a private draft exists.

The isolated publication workflow test runs draft → review → publish without a live database, verifies that only publishing increments the revision and captures a snapshot, confirms Respond selects only published records, rejects invalid lifecycle shortcuts, and keeps the visible workflow actions synchronized with the server state machine.

## Phase 8 release gate

Run `npm run verify:preplan-v2` before publishing a preview checkpoint. It performs scoped Preplan lint, a production build, and the focused Operational Preplan, Respond, migration, permission, responsive, accessibility, and legacy-compatibility tests. The command is read-only with respect to hosted data and must never create, edit, publish, archive, or delete production records.

| Verification area | Current evidence | Status |
| --- | --- | --- |
| Domain calculations and lifecycle dates | Deterministic Node tests | Automated |
| Operational API validation and cross-preplan safeguards | Route contract tests | Automated |
| Migration, legacy Arrival backfill, and bootstrap marker | Migration and bootstrap tests | Automated |
| Draft visibility and direct URL permission enforcement | Permission contract tests | Automated |
| Draft → review → publish → Respond lifecycle | Isolated state-machine and route contract test | Automated, no live database |
| Respond alerts, rooms, levels, HazMat, zones, hose lays, attachments, offline rules, and existing behavior | Respond contract tests | Automated |
| Phone, iPad, desktop, touch targets, keyboard tabs, reduced motion, and map alternative | Responsive and accessibility guardrails | Automated source contracts |
| Actual file upload, authorized streaming, denial, and storage cleanup | Signed-in preview with isolated test storage | Manual required |
| Real firefighter, editor, reviewer, publisher, administrator, allow override, and deny override sessions | Signed-in preview role matrix | Manual required |
| Complete 20-step authoring-to-Respond scenario at phone, iPad, and desktop sizes | Maintained browser runner plus isolated test database/storage | Not automated yet |
| Offline browser cache, reconnect, and private-data clearing | Signed-in browser with controlled network state | Manual required |
| Visual contrast, focus order, long-content layout, and map interaction | Human preview inspection | Manual required |

Automated source contracts are regression safeguards, not substitutes for the remaining signed-in browser and storage checks. Production promotion is not authorized by a passing release gate alone.

The seven required acceptance scenarios and their evidence state are tracked in `docs/preplan-v2-acceptance.md`.

Manual preview checks must cover:

1. Open an existing legacy preplan and confirm its original fields, footprint, features, and photos are unchanged.
2. Add levels, rooms and aliases; reload and verify sort/default behavior.
3. Add scheduled, active, expiring and expired alerts; test every expiration action at controlled timestamps.
4. Add a verified HazMat record and confirm Respond shows no guessed ERG values.
5. Upload valid/invalid images and PDFs, test size/type rejection, authorized streaming, denial, and cleanup.
6. Submit, return, publish, archive, inspect revision history, and confirm Respond consumes only the intended published revision.
7. Test exact, partial, ambiguous and absent CAD room language.
8. Disable the network after a successful published fetch and confirm the cache badge, revision, timestamp, and absence of drafts/private URLs.
9. Verify desktop, tablet, and phone layouts plus keyboard focus and readable contrast.
10. Test each new permission through rank settings and employee allow/deny overrides.
