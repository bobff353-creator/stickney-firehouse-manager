# CIS CAD readiness plan

Status: planning only. No CIS connection, secret, unit import, or live incident delivery is enabled by this document.

## Reference evidence

The photo set in `drive-download-20260831T145032Z-1-001.zip` shows the **CIS MCS Client** Unit Status screen used by Cicero Consolidated Dispatch. The screen mixes FIRE, EMS, POLICE, DISPATCH, and OTHER records. It is useful for learning CAD unit identifiers and display descriptions, but it is not a machine-readable unit export and it does not document the live incident-delivery payload.

Treat the photos only as dated reference evidence. Do not copy names, incident locations, police records, EMS records, or live statuses into the portal.

## FIRE-only rule

Only a row whose Service value is explicitly `FIRE` may enter the proposed CAD fire-unit directory.

Additional safeguards:

- Keep FIRE mutual-aid units separate from Stickney-owned Fleet apparatus.
- Exclude EMS, POLICE, DISPATCH, and OTHER rows.
- Exclude personnel, desks, offices, administrative logins, and training identities unless an administrator confirms that the identifier represents a dispatchable fire unit.
- Preserve the original CAD unit ID, agency code, and description exactly as supplied by CIS.
- Never overwrite the local Fleet apparatus name, UUID, status, or inventory record with a CAD value.
- A CAD unit may point to a local apparatus only after an administrator approves the match.

## Initial Stickney candidates visible in the photos

These are reference candidates, not imported records:

| CIS unit ID | CIS agency | CIS description shown | Local candidate | Mapping state |
| --- | --- | --- | --- | --- |
| `E1203` | `STFD` | `STFD ENG` / `ST1203 ENGINE` | Apparatus `1203` | Strong candidate; administrator must approve |
| `T1204` | `STFD` | `STFD TRUCK` / `ST1204 LADDER TRUCK` | Apparatus `1204` | Strong candidate; administrator must approve |
| `SFDCHIEF` | `STFD` | `STICKNEY FD CHIEF OFFICE` | None | Hold as a command identity; do not create Fleet apparatus |

The photographed status (`Avail` or `Out/Serv`) is a moment-in-time CAD status and must not be imported as the current Fleet status.

## Proposed unit-directory record

Store CAD identities in a separate department-scoped directory with these fields:

- provider (`cis`)
- CAD unit ID
- agency code
- service type
- provider description
- owning department or mutual-aid agency
- optional approved local apparatus UUID
- mapping state (`unreviewed`, `approved`, `rejected`)
- evidence source and verification date
- first seen and last seen timestamps from real deliveries

Use the directory to translate a responding unit such as `E1203` to the existing local apparatus `1203` for display. Keep the original `E1203` value with every incident for audit and replay.

## Existing portal foundation

The portal already contains a CIS adapter and authenticated receiver at `POST /api/cad/cis`. It can normalize JSON, form, XML, or key/value text into an incident number, event type, call type, address, city, narrative, responding units, coordinates, dispatch time, time out, and time in. It also supports duplicate detection, raw-payload retention, normalized receipts, incident updates, and close events.

That source foundation is not proof of a live CIS connection. The connection remains unverified until the dispatch provider supplies the actual delivery contract and a signed end-to-end delivery is received and persisted.

## Activation sequence

1. Obtain CIS/Cicero delivery documentation and a de-identified sample payload from the authorized dispatch contact.
2. Confirm the exact incident number, event/update ID, event status, unit list, address, coordinates, dispatch time, en-route time, and clear-time fields.
3. Configure `CIS_CAD_WEBHOOK_SECRET` on the server only. Never place the value in source code, browser code, screenshots, or documentation.
4. Test signed synthetic `new`, `update`, duplicate, and `close` events without notifying members or opening a real call.
5. Run shadow mode: retain and normalize real deliveries while preventing Respond, board, notification, and command-board fan-out.
6. Review all observed `FIRE` unit IDs in the approval screen. Match only confirmed Stickney apparatus; retain mutual-aid units as external fire identities.
7. Verify one authorized live test incident from CIS receipt through database persistence, Respond, Operations Board, preplan lookup, unit mapping, update, and clear.
8. Enable production fan-out only after the test incident closes correctly and an administrator signs off.

## Acceptance criteria

- Invalid signatures are rejected and recorded without creating an incident.
- Duplicate deliveries do not create duplicate incidents.
- Only `FIRE` unit-directory rows are eligible for apparatus display.
- Police, EMS, dispatch, personnel, and administrative identities never become Fleet apparatus.
- Local apparatus UUIDs and inventory records remain unchanged.
- Original CIS identifiers and raw payloads remain available for audit and replay.
- New, updated, and cleared calls display consistently in Respond and the Operations Board.
- A live status is never claimed until a signed delivery is received, stored, rendered, updated, and cleared end to end.
