import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { portalPages, portalPageFromSearch, portalPageUrl, portalPageLabel } from "../app/portal-navigation.ts";
import { portalConnectionState, readPortalJson } from "../app/portal-status.ts";
import { preserveEditorDrafts } from "../app/preserve-editor-drafts.ts";

test("every portal screen has a refreshable round-trip URL", () => {
  for (const page of portalPages) {
    const url = new URL(portalPageUrl("/", "", page), "https://example.test");
    assert.equal(portalPageFromSearch(url.search), page);
  }
  assert.equal(portalPageLabel("Dashboard"), "Home");
  assert.equal(portalPageFromSearch("?page=unknown"), null);
});
test("leaving a record removes stale focus and old edit mode", () => {
  const url = portalPageUrl("/", "?page=safety-inspections&hydrant=h1&edit=1&display=tv", "Respond");
  assert.equal(url, "/?page=respond&display=portal");
  assert.equal(portalPageFromSearch("?page=safety-inspections&hydrant=h1"), "Field Preplans");
  assert.equal(portalPageFromSearch("?display=tv&preplan=p1"), "Operations Board");
  assert.equal(portalPageFromSearch("?page=monthly-safety-inspections"), "Safety Inspections");
});
test("a map or search selection opens the exact record in read mode", () => {
  assert.equal(portalPageUrl("/", "?hydrant=old&edit=1", "Field Preplans", { preplan: "verified-plan" }), "/?page=field-preplans&display=portal&preplan=verified-plan");
  assert.equal(portalPageUrl("/", "", "Field Preplans", { hydrant: "verified-hydrant" }), "/?page=field-preplans&display=portal&hydrant=verified-hydrant");
});
test("portal connection never claims all screens are saved or current", () => {
  assert.equal(portalConnectionState(true, false, "", true).label, "Online");
  assert.equal(portalConnectionState(true, false, "failed", true).label, "Needs attention");
  assert.equal(portalConnectionState(false, false, "", true).label, "Offline");
  assert.equal(portalConnectionState(true, false, "", false).label, "Loading");
  assert.equal(portalConnectionState(true, false, "", true, true).label, "Saving hours");
});
test("bounded read requests reject failures instead of returning empty successes", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async (_url, options) => {
      assert.equal(options.cache, "no-store");
      assert.ok(options.signal instanceof AbortSignal);
      return { ok: false, json: async () => ({ error: "Unavailable" }) };
    };
    await assert.rejects(readPortalJson("/api/test", "Missing"), /Unavailable/);
  } finally { globalThis.fetch = original; }
});
test("saving one checklist row preserves other unsaved rows and adds new rows", () => {
  const current = [{id:"one",label:"saved old"},{id:"two",label:"unsaved wording"}];
  const incoming = [{id:"one",label:"server saved"},{id:"two",label:"original"},{id:"three",label:"new"}];
  assert.deepEqual(preserveEditorDrafts(current,incoming,"one"),[incoming[0],current[1],incoming[2]]);
  assert.equal(current[1].label,"unsaved wording");
});
test("inspection attachments preserve checkmarks and navigation protects unsaved work", () => {
  const source = fs.readFileSync("app/safety-inspections.tsx","utf8");
  assert.match(source,/keepDraft: true, keepEditor: true/g);
  assert.match(source,/useUnsavedWork\(recordDirty \|\| editorDirty, saving\)/);
  assert.match(source,/savedItemId: item.id/);
  assert.match(source,/savedTemplateId: templateDraft.id/);
  assert.match(source,/disabled=\{recordDirty \|\| saving\}/);
  assert.match(source,/if \(confirmLeavingWork\(\)\) void load\(\)/);
});
test("navigation and search handle unavailable sources and browser history", () => {
  const source=fs.readFileSync("app/payroll-app.tsx","utf8");
  assert.match(source,/Promise.allSettled/);
  assert.match(source,/if \(!term\) return screens.slice/);
  assert.match(source,/permittedPages.includes\(item.page\)/);
  assert.match(source,/navigate\(item.page, item.record\)/);
  assert.match(source,/addEventListener\("popstate", fromHistory, \{ capture: true \}\)/);
  assert.match(source,/if \(!confirmLeavingWork\(\)\) return/);
});
test("dashboard does not render operational all-clear cards before a briefing loads", () => {
  const source=fs.readFileSync("app/role-dashboard.tsx","utf8");
  assert.match(source,/\{briefing && <section className="command-status-grid"/);
  assert.match(source,/Status not yet verified/);
  assert.doesNotMatch(source,/Latest officer check reports equipment present/);
  assert.match(source,/allowedPages.includes\(page\)/);
});
test("idle Respond displays interrupted updates even in full screen", () => {
  const source=fs.readFileSync("app/respond.tsx","utf8");
  const map=fs.readFileSync("app/respond-overview-map.tsx","utf8");
  assert.match(source,/Current call status cannot be verified/);
  assert.match(source,/updatesAvailable=\{updatesAvailable\}/);
  assert.match(source,/signal: AbortSignal.timeout\(15000\)/);
  assert.match(map,/updatesAvailable \? "No active calls" : "Current call status unavailable"/);
});
