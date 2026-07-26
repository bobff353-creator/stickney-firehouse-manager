import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("weather route requests two Stickney forecast days in Fahrenheit", async () => {
  const source = await readFile(new URL("../app/api/weather/route.ts", import.meta.url), "utf8");
  assert.match(source, /forecast_days: "2"/);
  assert.match(source, /temperature_unit: "fahrenheit"/);
  assert.equal(source.includes('timezone: "America/Chicago"'), true);
  assert.equal(source.includes('latitude: "41.8189"'), true);
});

test("operations board cycles title, today, and tomorrow", async () => {
  const source = await readFile(new URL("../app/operations-board.tsx", import.meta.url), "utf8");
  assert.equal(source.includes('["title", "today", "tomorrow"]'), true);
  assert.match(source, /Today’s weather/);
  assert.match(source, /Tomorrow’s weather/);
});
