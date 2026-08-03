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
