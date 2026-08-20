# Operational Preplan 2.0 verification matrix

Automated checks cover lifecycle dates, hidden expiration behavior, level labels, plan coordinates, polygon area, hose sections/reserve/capacity, explainable hazard scores, fire-area controlling flow, conservative CAD room matching, ERG source pinning, private asset controls, normalized migration tables, legacy Arrival backfill, RLS, and route-to-migration column contracts.

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
