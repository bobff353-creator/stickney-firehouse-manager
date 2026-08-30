import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const route = await readFile(new URL("../app/api/chief-board/route.ts", import.meta.url), "utf8");
const panel = await readFile(new URL("../app/chief-board-panel.tsx", import.meta.url), "utf8");
const schema = await readFile(new URL("../db/schema.ts", import.meta.url), "utf8");
const attachmentRoute = await readFile(new URL("../app/api/chief-board/attachments/[attachmentId]/route.ts", import.meta.url), "utf8");
const riverRoute = await readFile(new URL("../app/api/river-gauge/route.ts", import.meta.url), "utf8");

test("Chief Notes support expiration and durable private attachments", () => {
  assert.match(schema, /chiefBoardAttachments/);
  assert.match(schema, /expiresAt: text\("expires_at"\)/);
  assert.match(route, /request\.formData\(\)/);
  assert.match(route, /config\.BUCKET!\.put/);
  assert.match(route, /expires_at = '' OR datetime\(expires_at\) > datetime\('now'\)/);
  assert.match(attachmentRoute, /content-disposition/);
  assert.match(panel, /Show note until \(optional\)/);
  assert.match(panel, /Attachments and photos \(up to 5\)/);
});

test("administrators can edit an existing Chief memo without replacing its attachments", () => {
  assert.match(route, /export async function PATCH/);
  assert.match(route, /Administrator privileges are required/);
  assert.match(route, /UPDATE chief_board_items SET title = \?, body = \?, expires_at = \?, updated_at = CURRENT_TIMESTAMP/);
  assert.match(route, /item_type = 'note' AND active = 1/);
  assert.match(panel, /Edit memo/);
  assert.match(panel, /Edit this memo/);
  assert.match(panel, /method: "PATCH"/);
  assert.match(panel, /Existing memo attachments stay connected/);
  assert.match(panel, /Save Memo Changes/);
});

test("Chief events require a start and end and email active employee profiles", () => {
  assert.match(route, /requiredDate\(form\.get\("startsAt"\)/);
  assert.match(route, /requiredDate\(form\.get\("endsAt"\)/);
  assert.match(route, /The event end must be after the start/);
  assert.match(route, /JOIN employees e ON e\.id = p\.employee_id WHERE e\.active = 1/);
  assert.match(route, /BEGIN:VCALENDAR/);
  assert.match(route, /METHOD:REQUEST/);
  assert.match(route, /idempotency-key/);
  assert.match(route, /stickney-department-event\.ics/);
  assert.match(panel, /Add & Send Invites/);
});

test("Chief Board rotates the live NOAA Des Plaines River gauge every 12 seconds", () => {
  assert.match(panel, /fetch\("\/api\/river-gauge"\)/);
  assert.match(panel, /slideCount\), 12000/);
  assert.match(panel, /Des Plaines River · Lyons/);
  assert.match(panel, /Open live NOAA gauge and hydrograph/);
  assert.match(riverRoute, /api\.water\.noaa\.gov\/nwps\/v1\/gauges\/\$\{gaugeId\}/);
  assert.match(riverRoute, /actionStage/);
  assert.match(riverRoute, /minorStage/);
  assert.match(riverRoute, /majorStage/);
  assert.match(riverRoute, /water\.noaa\.gov\/gauges\/\$\{gaugeId\}/);
});
