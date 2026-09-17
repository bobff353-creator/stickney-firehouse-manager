# Stickney CIS app-side handoff

Direct CIS delivery is disabled by default. These changes do not configure the hosted secret, approve identifiers, or certify the vendor connection. Existing approved CAD email delivery continues.

## Administrator setup

1. Settings → CIS CAD Integration: enter the department agency identifiers supplied by dispatch. This is an agency scope, not a city or incident-type filter; EMS and out-of-town mutual aid are included.
2. Explicitly map each exact CIS unit name to an existing department Fleet apparatus. Do not guess prefixes or use the department-wide STIF identifier as a rig. Unknown units remain unmapped and appear in delivery receipts.
3. Save **Shadow test** after dispatch has approved the authentication/network contract and the server webhook secret has been configured. Shadow receipts and incident state are separate from live mode: no dispatch/Daily Log records, board call alerts, or push outbox writes.
4. Test new, partial notes, full unit snapshot, unit assignment/removal, duplicate, older update, full incident close, and a late event after close. Verify two rigs on one call and simultaneous calls, including EMS/mutual aid. Confirm unknown agencies are rejected and unknown units never route to a guessed apparatus.
5. Only after vendor approval and testing, an authorized administrator may explicitly confirm live writes. The application still labels end-to-end verification as pending; an accepted receipt alone does not prove a real CIS connection or field-device delivery.
6. Respond Device Modes: select Apparatus Respond, choose the saved Fleet rig, then Save device mode on **each device**. The Live Operations board remains department-wide; Respond and its completed-call history are apparatus-filtered. The board's normal selector and synchronized TV rotation show every active department call. Selecting a call never bypasses the apparatus filter.

## Prepared receiver contract (must be confirmed with CIS)

`POST /api/cad/cis` accepts a server-held Bearer secret or `x-cis-signature: sha256=<hex HMAC-SHA256 of exact request body>`. The database integration credential remains server-only and is independent of any browser session. Limit: 64 KB UTF-8 per delivery; exceptionally large merged incidents are rejected rather than partially saved.

Preferred canonical JSON fields:

- `incidentId`: stable identifier, at most 128 characters; never reuse across unrelated incidents.
- `eventId`: stable delivery identifier, at most 128 characters; duplicates are scoped to incident and shadow/live mode. Missing event IDs fall back to an exact body fingerprint.
- `agency`: approved department agency identifier; required on initial events, inherited only on an already accepted incident.
- `status`: `new`, `update`, or explicit incident `closed`. `incidentStatus: closed` explicitly closes the whole incident. `timeIn` alone or a unit becoming available never closes it.
- `dispatchedAt`: initial dispatch date/time with explicit timezone offset or Z. Required on a new incident. `callType` and/or `address` are also required initially.
- `sequence`: nonnegative, safe integer, monotonically increasing per incident; if used initially, required on every subsequent event. Alternatively every update requires `eventAt` with an explicit timezone, strictly later than the last event. Do not send a date/time without an offset.
- `respondingUnits`: complete current unit snapshot (string or scalar array); an explicit empty list clears current assignments. Omitting the field preserves assignments.
- `unitId` plus `unitAction: assigned` / `available` (or equivalent action/status): add or remove just that unit. This does not close the incident. Do not mix a partial unit list with the full-snapshot field.
- `narrative`: replacement current CAD notes, not an append-only delta. Omitted/blank scalar fields preserve prior details. Coordinates require a valid latitude/longitude pair; blanks never become zero/zero.

The parser also supports common aliases and flat form/XML/labeled-text packets. A sanitized actual vendor sample is still required to validate their structure and semantics; this is not a claim of arbitrary vendor-schema compatibility.

## Delivery behavior

- The receipt, merged state, operational incident, Daily Log projection and durable push outbox commit in one existing PostgreSQL transaction. Optimistic guards retry conflicting deliveries; failed saves roll back. No new public tables or permissions are added.
- New notifications use the existing durable outbox/worker. Duplicate or ignored stale events do not schedule another delivery. Realtime board/Respond signaling and fallback timing remain unchanged.
- A first partial update returns retryable HTTP 409 until the full initial snapshot arrives. Closed incidents stay closed, including after late new/update events. Incident IDs must not be recycled.
- Full CIS closure also closes a matching prior email incident. A member-entered return time is preserved. If CAD supplies no reliable closure time, the incident is still suppressed from active/fallback lists without fabricating a return time.
- Current assigned units drive Respond. The union of involved rigs is retained in the Daily Log/history after individual rigs clear.
- CIS becomes authoritative only for an incident it has committed. Later copies from the email/bridge paths cannot overwrite its assignment, notes or closure. Other email incidents are unchanged.
- CIS incidents remain active until explicitly closed; they are not aged out at 12 hours. Existing email-only expiry behavior is retained. Active pools have no pre-filter 12/24-call cap; completed history is filtered before its 25-record cap.

## Verification

Local PostgreSQL/API tests cover authentication, admin gates, disabled/shadow/live isolation, strict scope/mappings, partial updates, unit clear, history, incident closure, email handoff, concurrent duplicates, stale events, rollback/retry, and active query behavior. All test records are fictional and no production incidents are sent. Vendor-side authentication, network delivery, actual payload mapping, live board display, acknowledgments/retries and real device delivery remain required before commissioning.
