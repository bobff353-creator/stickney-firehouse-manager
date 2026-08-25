import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("TV mode reserves complete rows for weather and apparatus status", async () => {
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const board = await readFile(new URL("../app/operations-board.tsx", import.meta.url), "utf8");

  assert.match(styles, /grid-template-rows: 48px 160px 100px minmax\(0,1fr\) 138px/);
  assert.match(styles, /\.tv-display \.board-header \{ height: 160px/);
  assert.match(styles, /\.tv-display \.board-header-rotation \{ min-width: 0; height: 144px/);
  assert.match(styles, /\.board-display-controls \{ position: sticky/);
  assert.match(board, /Pause rotation/);
  assert.match(board, /Feed delayed/);
  assert.match(styles, /\.tv-display \.apparatus-wide \{[^}]*height: 148px;[^}]*display: grid;[^}]*grid-template-rows: 38px minmax\(0,1fr\) auto/);
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
