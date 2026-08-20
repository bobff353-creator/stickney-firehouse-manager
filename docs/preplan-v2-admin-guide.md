# Operational Preplan 2.0 admin guide

## Record workflow

Use Field Preplans to locate the real building record. The legacy map, footprint, building systems, photos, and contacts remain the starting point. The Operational intelligence panel adds levels, rooms/CAD aliases, alerts, HazMat, private floor-plan assets, hose lays, and revision history.

Records move through Draft, In review, Published, and Archived. Respond is a published-data surface. Use Submit for review when the record is ready for an officer check, Publish revision only after the facts are verified, and Archive when the building should no longer appear as an active preplan. Do not hard-delete a record merely because it is outdated.

## Data quality

- Never add a room, hazard, chemical, quantity, fire-flow value, or apparatus capacity unless the department has verified it.
- Use aliases for the real wording CAD may send. A low-confidence or ambiguous match intentionally shows no room match.
- Alert effective and expiration values are operational instants. Choose `hide` only when an expired alert must disappear; otherwise require verification.
- Enter an ERG guide only after checking PHMSA ERG 2024. The portal links to the official source and does not guess.
- A fire-flow suggestion is advisory. Keep adopted-code flow separate from sprinkler demand plus hose allowance and record whether each fire-area separation was verified.
- Hose-lay inventory capacity is meaningful only when its apparatus inventory verification date is current.

## Permissions

Settings → Permissions contains independent Preplan 2.0 capabilities. Rank defaults are seeds; employee allow/deny overrides remain authoritative. A person who can edit the legacy record does not automatically have publish, HazMat, layer, attachment, verification, settings, or delete authority.

## Attachments and offline use

JPEG, PNG, WebP, and PDF assets are private, department-scoped, and limited to 25 MiB. Do not upload unrelated protected information. Respond caches only published operational payloads in IndexedDB. The cache badge shows whether the view is live or offline and when it was last refreshed.
