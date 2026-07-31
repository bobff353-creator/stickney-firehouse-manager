import assert from "node:assert/strict";
import test from "node:test";

const developmentPreviewMeta =
  /<meta(?=[^>]*\bname=["']codex-preview["'])(?=[^>]*\bcontent=["']development["'])[^>]*>/i;

test("renders development preview metadata", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  const response = await worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );

  assert.equal(response.status, 200);
  assert.match(
    response.headers.get("content-type") ?? "",
    /^text\/html\b/i,
  );
  assert.match(await response.text(), developmentPreviewMeta);
});

test("places Inventory under Station Duties without 360 branding", async () => {
  const source = await import("node:fs/promises").then((fs) =>
    fs.readFile(new URL("../app/payroll-app.tsx", import.meta.url), "utf8"),
  );

  assert.match(source, /label: "Station Duties"/);
  assert.match(source, /\{ label: "Inventory", page: "Inventory" \}/);
  assert.match(source, /const inventoryUrl = "\/inventory"/);
  assert.match(source, /sidebar-group-toggle/);
  assert.match(source, /mobile-bottom-tabs/);
  assert.match(source, /type: "Preplan"/);
  assert.match(source, /type: "Screen"/);
  assert.doesNotMatch(source, /inventory-360-command\.bobff353\.chatgpt\.site/);
  assert.doesNotMatch(source, /label: "Inventory 360"/);
});
