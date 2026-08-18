import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("Field Preplans has a Publish tab with transition buttons gated by the right permission per action", async () => {
  const page = await read("../app/field-preplans.tsx");
  assert.match(page, />Publish</);
  assert.match(page, /action:"transitionPreplan"/);
  assert.match(page, /action:"restoreRevision"/);
  assert.match(page, /Submit for Review/);
  assert.match(page, /Publish<\/button>/);
  assert.match(page, /canReview&&<button onClick=\{\(\)=>void transition\("draft"\)\}>Return to Draft/);
  assert.match(page, /canPublish&&<button className="accept-footprint" onClick=\{\(\)=>void transition\("published"\)\}>Publish/);
  assert.match(page, /canDelete&&<button className="danger" onClick=\{\(\)=>void transition\("archived"\)\}>Archive/);
  assert.match(page, /Revision history/);
  assert.match(page, /lifecycle-badge/);
});

test("Autosave never publishes a draft — publication is only reachable through an explicit transition button", async () => {
  const page = await read("../app/field-preplans.tsx");
  // savePreplan (the autosave/manual-save path) must never itself set lifecycle_status
  // to published; only the explicit transitionPreplan action does that.
  const savePreplanApi = await read("../app/api/field-preplans/route.ts");
  const saveBlockStart = savePreplanApi.indexOf('action === "savePreplan"');
  const saveBlockEnd = savePreplanApi.indexOf('action === "saveFeature"');
  const saveBlock = savePreplanApi.slice(saveBlockStart, saveBlockEnd);
  assert.equal(saveBlock.includes("lifecycle_status='published'"), false, "savePreplan must not silently publish");
});
