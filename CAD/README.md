# CAD

A standalone **Computer-Aided Dispatch** application. It is self-contained —
its own database, its own login, its own deployment — and shares nothing with
any other system.

## What it does

- **Closest-unit dispatching.** Apparatus and vehicles report their location
  (AVL). The console ranks in-service units by distance to an incident so a
  dispatcher can send the nearest available unit in one click.
- **Real-time vehicle location.** Units stream GPS pings in; the board shows
  live positions with freshness indicators.
- **Bidirectional webhooks.** A signed inbound endpoint receives `location`,
  `status`, `note`, and `incident` events from FD vehicles and other CAD
  agencies. Matching outbound deliveries push events to partner agencies that
  subscribe to them (HMAC-SHA256 signed, with delivery receipts).
- **Real-time incident notes.** Timestamped, sequenced CAD notes per incident,
  logged from the console and streamed in from partner agencies as a call
  unfolds.
- **Fire-alarm monitoring.** Registered alarm panels post signals to a signed
  endpoint. An alarm signal on an auto-dispatch panel opens a live incident and
  logs the first note.

## Tech

Next.js (App Router) · React · libSQL/Turso · Web Crypto auth. No other runtime
services required.

## Quick start (local)

```bash
npm install
cp .env.example .env.local     # then edit values
npm run dev                    # http://localhost:3000
```

With `CAD_DATABASE_URL=file:./cad.db` (the default), a local SQLite file is
created automatically and seeded with an admin dispatcher from `CAD_ADMIN_*`.
Sign in at `/login` with those credentials.

```bash
npm test          # unit tests (pure logic + auth)
npm run lint      # eslint
npm run build     # production build
```

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `CAD_DATABASE_URL` | prod | `file:./cad.db` for local, `libsql://…` for Turso |
| `CAD_DATABASE_AUTH_TOKEN` | prod (Turso) | Turso database token |
| `CAD_SESSION_SECRET` | **prod** | Signs login session cookies — set a long random value |
| `CAD_ADMIN_EMAIL` / `CAD_ADMIN_PASSWORD` / `CAD_ADMIN_NAME` | first boot | Seed dispatcher, created only when the users table is empty |
| `CAD_SOURCE_NAME` | no | Label used in outbound webhook envelopes |

## Deploy (Vercel + Turso)

1. Create a Turso database and copy its URL + auth token.
2. Import this repo into Vercel.
3. Set the env vars above in the Vercel project (use a strong
   `CAD_SESSION_SECRET` and real `CAD_ADMIN_*`).
4. Deploy. The schema is created and the admin seeded on first request.

## Integration reference

All machine endpoints authenticate with a per-peer bearer token (issued in the
console) **or** `x-cad-*-id` + `x-cad-signature: sha256=<HMAC-SHA256 of body>`.

**Inbound from vehicles / CAD agencies** — `POST /api/cad/webhooks`

```json
{ "event": "location", "data": { "unitNumber": "E1", "latitude": 41.82, "longitude": -87.78, "status": "enroute" } }
{ "event": "status",   "data": { "unitNumber": "E1", "status": "onscene" } }
{ "event": "note",     "data": { "incidentId": "INC-1", "note": "Working fire", "category": "size_up" } }
{ "event": "incident", "data": { "incidentId": "INC-1", "callType": "Structure Fire", "address": "100 Main St", "latitude": 41.82, "longitude": -87.78 } }
```

**Inbound alarm signal** — `POST /api/cad/alarms/signal`

```json
{ "signalType": "alarm", "zone": "3", "description": "Waterflow", "eventId": "abc-123" }
```

Outbound deliveries send the same envelope shape (`{ event, emittedAt, source,
data }`) to each subscribed agency's configured URL.

## Project layout

```
lib/         cad-service (pure logic) · cad-server (db + fan-out) · db · auth · bootstrap
middleware   session gate for pages + APIs (machine endpoints excluded)
app/login    dispatcher login
app/console  live dispatch board, agency interop, alarm monitoring
app/api      auth (login/logout) · cad (dispatch, webhooks, agencies, alarms, alarms/signal)
tests        unit tests for pure logic and auth
```
