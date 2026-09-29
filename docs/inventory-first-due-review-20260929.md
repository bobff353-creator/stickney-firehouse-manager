# Inventory workflow review — September 29, 2026

Reviewed the six public [First Due Assets & Inventory sections](https://www.firstdue.com/products/assetsinventory): Checks, Fleet, Equipment, Inventory, Work Orders, and Medications. This compares advertised capabilities with the current Stickney application; it is not an evaluation of a signed-in First Due installation.

| Area | Useful reference | Stickney result from this review |
| --- | --- | --- |
| Checks | Configurable checks, schedules, and failed-item work orders | Existing per-apparatus checks, photos, deficiencies, and reports remain. Active shared checks keep their five-second refresh. |
| Fleet | Apparatus records, compartments, and readiness | Existing vehicle records and service history remain. Repair filtering now makes it easier to find one vehicle's outstanding work. Loading a vehicle record no longer prematurely says it needs setup. |
| Equipment | Individual records, kits, and service testing | Added filters for out-of-service/in-repair equipment and equipment with an active service reminder. Existing vehicle, compartment, barcode, and serial search remains. |
| Inventory | Location counts, restocking, and purchasing | Added low-stock, expired, and expiring summaries; location filtering; and an editable restock-request quantity. A request never increases physical stock. |
| Work Orders | Stage boards and repair costs | Added search, apparatus, stage, and priority filters. Open work is the default; completed records remain accessible. Repair completion opens explicitly and fits phone screens. Unrecorded costs display as unrecorded. |
| Medications | Lot expiration and protected custody | Ordinary stock now has clearer expiration filters and explicit expired physical quantities. Controlled-medication custody is still a separate unfinished module, not part of this release. |

## Other corrections

- Expiration uses Chicago calendar dates, including midnight and daylight-saving boundaries.
- Supply overview numbers count supply records, not a misleading total of mixed units.
- Search and expiration filters respect the chosen location. Each supply card explicitly retains the department-wide physical total.
- Browsing pages refresh on a timer once per minute instead of every five seconds. Active checks retain fast updates; save, focus, reconnect, and manual refresh behavior remains. This reduces scheduled browsing requests from 12 to 1 per minute; total database CPU savings have not been measured.
- New filters and repair completion fields remain readable in the device's dark theme.

## Verification

- 41 targeted tests passed, covering filters, expiration, check workflows, service schedules, maintenance history, and responsive UI contracts.
- Targeted lint and the production build passed.
- Browser tests used an isolated, fictional local fixture. Verified combined repair filters, completed records, equipment attention filters, expiry/location combinations, failed restock saves retaining the entered quantity, and successful requests preserving physical stock.
- Tested 390-pixel phone layout with no document overflow.
- No department inventory quantities, check results, or work orders were changed during this review.

## Larger future work

Purchase-order receiving, coordinated equipment/kit transfers, and protected medication custody would need dedicated workflows and server-side transaction/audit safeguards. They are not implemented or represented as available in this release.
