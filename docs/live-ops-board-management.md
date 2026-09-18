# Live Ops board management

Open **Live Operations → Manage Live Ops Board** with `settings.manage` permission.

- Layout: enable, reorder and set 8–60-second durations for the information-panel slides. Close Calls can use three summaries or the existing height-aware three/four layout.
- Announcement: one short department-wide notice, optional future start, required end. Times are entered in the administrator device's displayed time zone and stored as UTC instants. It expires locally without a timer-triggered server request.
- Content: opens the existing Officer Notes/Events, training and resource-link editors. Those editors retain their own save actions. Events retain their invitation behavior; routine announcements do not send invitations or push messages.
- Device setup: links to existing per-browser Respond Device Modes. This release does **not** add a remote-device registry, remote reload, per-device content targeting or acknowledgement tracking.
- Preview is local to the current screen and reuses the actual board and its existing data. Publish is disabled until a valid draft has been previewed. Changing the draft requires another preview.
- Restore loads the previous published setup into a draft. It requires preview and publish; it does not delete Chief notes, classes or operational records.

## Safety and persistence

Calls, staffing, OIC, apparatus, road closures and delayed-data warnings are not configurable off. Equipment-issue and pending-check counts remain visible above apparatus status. The 90-second CAD takeover and Respond apparatus eligibility logic are unchanged. TV mode hides editing controls, including Chief notes controls.

`/api/board-configuration` requires server-verified `settings.manage` for both GET and PUT. The existing authenticated portal proxy remains mandatory. Data is stored under `board-configuration:stickney:v1` in the private `system_meta` table, using one compare-and-swap write for configuration, previous version, revision and editor identity. No new schema, grants, exposed tables, credentials or dependencies are required.

The existing `system_meta` → `chief` operational signal triggers a fresh board read. Configuration travels with `/api/chief-board?include-links=1`; an unchanged revision omits the payload, and board readers do not receive previous-version history. Existing fallback/reconciliation remains. Same-browser tabs also receive an invalidation-only BroadcastChannel message. No extra polling loop was added. All screens derive the weighted rotation from their clocks and the shared settings.

## Verification

Automated cases: default preservation, input bounds, unique slides, time boundaries, deterministic rotation, durable PostgreSQL saves, no-op writes, previous-version restore, permission denial, concurrent edits, failed writes, indexed lookup, preservation of unrelated rows, delta reads and corrupt-setting isolation.

Local browser fixture: `node scripts/preview-board-feeds.mjs`, then `/tests/fixtures/board-feeds-audit.html?configuration=1` on the printed loopback URL. Add `&tv=1` for a station screen or `&member=1` for a non-admin. This uses fictional feeds and an isolated PostgreSQL database with the actual configuration API/store. It never reads production credentials or writes live records.

Checked in the browser: edit/reorder, preview gating, publish/reopen, failed-save draft retention and retry, scheduled notice rendering, second-screen delivery, draft isolation, restore, member controls, officer-note editor navigation, desktop/phone/TV layouts and console errors. The local fixture does not prove live Supabase Broadcast delivery; verify that after deployment with a harmless department-approved configuration change.
