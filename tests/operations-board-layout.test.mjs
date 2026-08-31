import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("TV mode reserves complete rows for weather and apparatus status", async () => {
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const board = await readFile(new URL("../app/operations-board.tsx", import.meta.url), "utf8");

  assert.match(styles, /grid-template-rows: 36px 112px 78px minmax\(0,1fr\) 92px/);
  assert.match(styles, /\.tv-display \.board-header \{ height: 112px/);
  assert.match(styles, /\.tv-display \.board-header-rotation \{ min-width: 0; height: 104px/);
  assert.match(styles, /\.board-display-controls \{ position: sticky/);
  assert.match(board, /Pause rotation/);
  assert.match(board, /Feed delayed/);
  assert.match(styles, /\.tv-display \.apparatus-wide \{[^}]*height: 92px;[^}]*display: grid;[^}]*grid-template-rows: 28px minmax\(0,1fr\)/);
  assert.match(styles, /\.tv-display \.apparatus-wide > div \{[^}]*grid-auto-rows: minmax\(0,1fr\);[^}]*overflow: hidden/);
});

test("operations panels rotate without rendering carousel indicator bars", async () => {
  const [styles, board, staffing, chief] = await Promise.all([
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/operations-board.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/staffing-rotation.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/chief-board-panel.tsx", import.meta.url), "utf8"),
  ]);
  const source = [styles, board, staffing, chief].join("\n");

  assert.doesNotMatch(source, /board-header-dots|staffing-rotation-controls|rotation-indicator|chief-rotation-dots/);
  assert.doesNotMatch(source, /rotates every/i);
  assert.match(board, /Pause rotation/);
});

test("TV rotation keeps every operations slide mounted and preserves the last good board on refresh errors", async () => {
  const [styles, board] = await Promise.all([
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/operations-board.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(board, /className="rotation-slide" hidden=\{rotation !== "equipment"\}/);
  assert.match(board, /className="rotation-slide" hidden=\{rotation !== "duty"\}/);
  assert.match(board, /className="rotation-slide" hidden=\{rotation !== "news"\}/);
  assert.match(board, /className="rotation-slide" hidden=\{rotation !== "fatalities"\}/);
  assert.match(styles, /\.rotation-slide\[hidden\] \{ display: none !important; \}/);
  assert.match(board, /The last confirmed board remains on screen/);
});

test("compact TV panels fit without internal staffing scrollbars or oversized headers", async () => {
  const [styles, staffing] = await Promise.all([
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/staffing-rotation.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(styles, /\.board-display-controls \{[^}]*width: fit-content/);
  assert.match(styles, /\.operations-board \.board-panel > header \{ min-height: 44px/);
  assert.match(styles, /\.operations-board\.tv-display \.board-panel > header \{ min-height: 32px/);
  assert.match(styles, /\.tv-display \.schedule-24-list \{[^}]*overflow: hidden/);
  assert.match(styles, /\.tv-display \.new-member-photo \{ width: 68px; height: 82px/);
  assert.match(styles, /\.tv-display \.board-alert \{ display: none; \}/);
  assert.match(staffing, /schedule\?\.items\.slice\(0, 6\)/);
  assert.match(staffing, /additional assignments remain on the full schedule/);
});

test("training rotations use a bounded two-column TV layout", async () => {
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(styles, /\.tv-display \.training-board \{[^}]*height: 100%;[^}]*grid-template-rows: auto minmax\(0,1fr\) auto;[^}]*overflow: hidden/);
  assert.match(styles, /\.tv-display \.training-course-list \{[^}]*grid-template-columns: repeat\(2,minmax\(0,1fr\)\);[^}]*grid-template-rows: repeat\(3,minmax\(0,1fr\)\);[^}]*overflow: hidden/);
  assert.match(styles, /\.tv-display \.training-course-list a:last-child:nth-child\(odd\) \{ grid-column: 1\/-1; \}/);
  assert.match(styles, /\.tv-display \.training-disclaimer \{ display: none; \}/);
});

test("24/7 TV mode prevents stalled refreshes and recovers after device interruptions", async () => {
  const [board, app, styles, idleLock, pinRoute, leaseMigration] = await Promise.all([
    readFile(new URL("../app/operations-board.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/payroll-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/session-idle-lock.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/auth/pin/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260831183130_tv_station_display_lease.sql", import.meta.url), "utf8"),
  ]);

  assert.match(board, /loadInProgressRef/);
  assert.match(board, /controller\.abort\(\), 15000/);
  assert.match(board, /wakeLock/);
  assert.match(board, /visibilitychange/);
  assert.match(board, /window\.addEventListener\("online", recover\)/);
  assert.match(board, /stickney-operations-tv-recovery/);
  assert.match(board, /10 \* 60 \* 1000/);
  assert.match(board, /24\/7 station mode/);
  assert.match(board, /Exit full screen/);
  assert.match(board, /document\.exitFullscreen\(\)/);
  assert.match(board, /onTvModeChange\?\.\(false\)/);
  assert.match(board, /aria-label="Exit full-screen TV mode and return to the portal"/);
  assert.match(styles, /\.tv-display \.board-exit-tv\{[^}]*position:fixed;[^}]*opacity:\.2/);
  assert.match(styles, /\.tv-display \.board-exit-tv:hover,\.tv-display \.board-exit-tv:focus-visible\{opacity:1/);
  assert.match(styles, /@media\(hover:none\)\{\.tv-display \.board-exit-tv\{opacity:\.42\}\}/);
  assert.match(app, /stickney-operations-tv-mode/);
  assert.match(app, /firehouse:tv-mode/);
  assert.match(app, /requestedDisplay === "portal"/);
  assert.match(idleLock, /stationDisplayRefreshMs = 5 \* 60 \* 1000/);
  assert.match(idleLock, /!stationDisplay && Date\.now\(\) - lastActivity/);
  assert.match(idleLock, /JSON\.stringify\(\{ display: stationDisplay \? "tv" : "portal" \}\)/);
  assert.match(pinRoute, /stationDisplaySeconds = 30 \* 24 \* 60 \* 60/);
  assert.match(pinRoute, /renew_portal_pin_unlock_for_user/);
  assert.match(pinRoute, /const systemClient = await getSupabaseSystemClient\(\)/);
  assert.match(idleLock, /if \(response\?\.status === 423\) lock\(true\)/);
  assert.match(idleLock, /const forceLock = \(\) => lock\(true\)/);
  assert.match(leaseMigration, /SECURITY DEFINER/);
  assert.match(leaseMigration, /p_user_id IS NULL/);
  assert.match(leaseMigration, /unlock_expires_at > now\(\)/);
  assert.match(leaseMigration, /REVOKE ALL ON FUNCTION public\.renew_portal_pin_unlock_for_user\(uuid, text, boolean\) FROM PUBLIC, anon, authenticated/);
  assert.match(leaseMigration, /GRANT EXECUTE ON FUNCTION public\.renew_portal_pin_unlock_for_user\(uuid, text, boolean\) TO service_role/);
});
