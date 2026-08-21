# Operational Preplan 2.0 administrator guide

## Record and data-quality rules

Open the real building in **Field → Preplans & Hydrants**. Preserve its established footprint, contacts, mapped systems, photos, and linked IDs. Operational Preplan 2.0 extends that record; it is not a separate demo.

Enter only verified facts. Never invent rooms, construction, occupants, chemicals, quantities, flow, apparatus capacity, ERG guides, protective distances, or geometry. Use unknown and empty states when information is unavailable.

## Author operational data

With the corresponding server permissions, users can add levels and CAD room aliases, alerts, HazMat and zones, private assets, annotations, hose lays, target-hazard factors, and structured construction and occupancy profiles.

Operational attachments accept JPG, PNG, WebP, or PDF up to 25 MB. A named annotation without geometry is labeled as awaiting mapped geometry. A zone radius is not automatically an ERG protective distance. Enter an ERG guide only after checking PHMSA ERG 2024.

## Publication workflow

The server enforces these transitions:

1. **Draft → Submit for review**
2. **In review → Return to draft** or **Publish revision**
3. **Published → Return to draft**, **Publish revision**, or **Archive**
4. **Archived → Return to draft**

Publishing creates an immutable revision snapshot and increments the revision. Respond selects published records only. Restoring an older revision creates a new published revision instead of rewriting history. Current private attachments and legacy mapped systems remain outside the restored operational layers.

Archive is the normal removal workflow. Hard deletion is separately permissioned and must not be used merely because information is old.

## Expiring records

The queue offers **Verify ongoing**, **Extend 30 days**, **Resolve**, and **Archive**. These actions are audited. Expired records are never automatically deleted, and invalid dates require review.

## Permission administration

Settings → Permissions preserves rank defaults and employee allow/deny overrides. The server checks every write.

| Capability | Purpose |
| --- | --- |
| `field_preplans.view` | View published preplans and Respond data |
| `field_preplans.edit` | Capture and update core data |
| `field_preplans.review` | Submit, return, and review revisions |
| `field_preplans.publish` | Publish, archive, and restore revisions |
| `field_preplans.manage_layers` | Manage levels, rooms, and layers |
| `field_preplans.manage_hazmat` | Manage HazMat and zones |
| `field_preplans.manage_attachments` | Manage private assets |
| `field_preplans.verify_expiring` | Review expiring records |
| `field_preplans.delete` | Separately controlled destructive removal |
| `field_preplans.manage_settings` | Manage calculation settings |

Working records are visible only to their owner or a user with edit, review, or publish authority. Direct detail, photo, and attachment URLs enforce the same lifecycle rule.

## Private assets and offline data

Assets use authenticated private routes and private cache headers. If storage succeeds but metadata fails, the upload route attempts object cleanup. Verify real cleanup in isolated preview storage before production authorization.

Respond caches only matched published packets in IndexedDB. It excludes drafts, authentication data, signed URLs, and private attachment bodies. Offline mode is read-only and timestamped; signing out clears packets.

## Preview and release checks

Run `npm run verify:preplan-v2`, then follow `docs/preplan-v2-testing.md`. A passing automated gate does not authorize production promotion. Complete signed-in role, upload/cleanup, offline-browser, viewport, and authoring-to-Respond checks against isolated preview data first.

For migration and rollback, use `docs/preplan-v2-data-migration.md`.
