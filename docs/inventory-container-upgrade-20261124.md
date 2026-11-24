# Inventory container upgrade — November 24, 2026

## Source changes

Bags, tool boxes, kits and other containers now have an Add / manage contents shortcut in equipment records and the inventory setup list. The editor puts finding and adding equipment before the saved contents list.

Search includes item names, barcodes, serial numbers, manufacturer/model, saved locations and current bag names. Filters select the current compartment or all locations on the rig, and loose equipment or equipment already grouped elsewhere. Search results page eight at a time; saved contents page ten at a time and have their own search.

Adding existing equipment preserves the original record. Moving from another bag names both containers and requires confirmation. Equipment in another compartment is findable but must have its location changed through Inventory before it can be added. Registered air equipment and nested containers retain their existing separate workflows. Creating new equipment uses the container’s saved location/checklist types. A stable create-request ID makes retries idempotent; conflicting or later-modified records are rejected rather than overwritten.

Existing edit/remove/delete controls, permission checks, department scope and saved history remain. Parent details cannot be saved or deleted over an unfinished contents draft. No dependency, schema, migration, notification or purchase changes.

## Verification

- 230 focused inventory, live-economy, suite-session-security and fleet-duty tests passed, including the real operations route with mocked database transport and picker tests.
- TypeScript and production build passed. ESLint and diff checks recorded separately in outputs/inventory-container-upgrade-20261124.
- Actual inventory UI in a localhost-only fictional transport: opened the equipment shortcut; searched barcode and model; added existing equipment; reviewed and confirmed an inter-bag move; found other-compartment equipment without an add control; paged search and contents; edited a contained item; confirmed parent Save refuses an unfinished child draft; simulated a create saved with lost confirmation, retried, and observed exactly one saved item.
- Phone 390px and tablet 820px layouts had no document horizontal overflow. Light/dark desktop styles inspected; phone controls met 44px height. The fixture was corrected to include the same rig-check and Watchline styles as production.
- These isolated checks do not establish physical-device behavior or live write persistence. Production review is read-only; no real inventory or check records are created or changed for testing.

## Production baseline

Stickney-scoped fingerprints before release: equipment 1,674 / 9b14062960f6e930ae0321fd995473bf; checks 29 / 0610a43b3518b2f5e5a17fe9d8f7b65f; check items 1,775 / b1619f178a4ac5c621cf0fa83e09313f. Station and schedule automatic email/text enabled-rule counts were both zero.

## Release

Pending source commit, push, deployment and live read-only verification. No database migrations.
