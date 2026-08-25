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

test("24/7 TV mode prevents stalled refreshes and recovers after device interruptions", async () => {
  const [board, app] = await Promise.all([
    readFile(new URL("../app/operations-board.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/payroll-app.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(board, /loadInProgressRef/);
  assert.match(board, /controller\.abort\(\), 15000/);
  assert.match(board, /wakeLock/);
  assert.match(board, /visibilitychange/);
  assert.match(board, /window\.addEventListener\("online", recover\)/);
  assert.match(board, /24\/7 station mode/);
  assert.doesNotMatch(board, /Exit TV mode/);
  assert.match(app, /stickney-operations-tv-mode/);
  assert.match(app, /requestedDisplay === "portal"/);
});
