# Operational Preplan 2.0 user guide

## What firefighters see

Field Preplans is the department record workspace. Respond is the incident-facing view. Respond reads only published preplans; a draft, review copy, or archived record never replaces the last published operational information.

Never treat a blank field as proof that a condition does not exist. The portal deliberately shows **Not entered**, **Not verified**, or an honest empty state when the department has not saved a verified fact.

## Open and read a building record

1. Open **Field → Preplans & Hydrants**.
2. Search by business, address, street, or hydrant ID.
3. Select the building record.
4. Review the established footprint, contacts, systems, and photos. Operational Preplan 2.0 appears below that record.

**Live published** is the current response record. **Live working copy** is not yet available in Respond. Use the level selector for Arrival/Ground, floors, basements, roofs, or other saved layers. Level-specific rooms, alerts, HazMat, zones, attachments, annotations, and hose lays change with the selection; building-wide warnings can remain visible.

- Unknown construction or occupancy stays unknown.
- Alerts show severity and lifecycle state.
- HazMat shows only saved values. Verify guides and protective actions against PHMSA ERG 2024 and current conditions.
- Hose lays are independent options. Do not add hydrant flows unless water-supply personnel verify the calculation.
- Attachments remain private and require signed-in preplan access.

## Use Respond during an incident

Respond refreshes live CAD information approximately every ten seconds. Confirm the incident address and match status before relying on the displayed preplan.

1. Read critical banners and target-hazard reasons first.
2. Confirm the published revision and timestamp.
3. Use the level switcher to move between Arrival and saved levels.
4. A reliable CAD room match may suggest and open a level. Ambiguous wording does not force a match.
5. Use **Floor Plan** for rooms and the highlighted match. Use **Footprint** for mapped systems; its text list provides equivalent keyboard and screen-reader controls.
6. Open feature details for status, location, verification, photos, and directions when coordinates exist.
7. Reconcile all preincident information with current command conditions.

## Offline Respond

**OFFLINE — READ-ONLY PREPLAN** means the browser is showing a previously cached published packet, not current CAD or database state. Check its revision and timestamp. Private attachment bodies, live navigation, current hydrant status, and writes are unavailable offline.

**OFFLINE — NO MATCHED PREPLAN CACHE** does not confirm that no preplan exists. Signing out clears private cached Respond packets.

## Accessibility and reporting problems

Respond supports keyboard tabs, Escape-to-close details, reduced motion, large touch targets, safe-area padding, and phone/iPad/monitor layouts. Fullscreen apparatus mode does not change data or permissions.

When reporting a problem, provide the incident or building address, displayed revision, page and level, expected result, and exact error. Do not copy protected attachments into an unapproved channel.
