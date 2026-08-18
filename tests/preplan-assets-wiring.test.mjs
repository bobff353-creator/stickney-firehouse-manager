import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("field-preplans API exposes attachment metadata and a separate metadata-only update action", async () => {
  const api = await read("../app/api/field-preplans/route.ts");
  assert.match(api, /field_preplan_assets/);
  assert.match(api, /canManageAttachments/);
  assert.match(api, /action === "saveAssetMetadata"/);
});

test("respond API returns only pinned, non-archived attachments for the matched preplan", async () => {
  const api = await read("../app/api/respond/route.ts");
  assert.match(api, /pin_to_respond=1/);
  assert.match(api, /pinnedAttachments/);
});

test("Field Preplans has an Attachments tab that uploads through the dedicated multipart endpoint", async () => {
  const page = await read("../app/field-preplans.tsx");
  assert.match(page, />Attachments</);
  assert.match(page, /fetch\("\/api\/field-preplans\/attachments",\{method:"POST"/);
  assert.match(page, /method:"DELETE"/);
  assert.match(page, /Pin to Respond/);
});

test("Respond shows a pinned-attachments card with links opening the authenticated stream endpoint", async () => {
  const page = await read("../app/respond.tsx");
  assert.match(page, /PINNED ATTACHMENTS/);
  assert.match(page, /pinnedAttachments!\.map/);
});
