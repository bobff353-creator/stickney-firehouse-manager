import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("weather route requests two Stickney forecast days in Fahrenheit", async () => {
  const source = await readFile(new URL("../app/api/weather/route.ts", import.meta.url), "utf8");
  assert.match(source, /forecast_days: "2"/);
  assert.match(source, /temperature_unit: "fahrenheit"/);
  assert.equal(source.includes('timezone: "America/Chicago"'), true);
  assert.match(source, /hourly: "weather_code,temperature_2m,precipitation_probability,wind_speed_10m"/);
  assert.match(source, /forecastHourly/);
  assert.match(source, /nextFourHours/);
  assert.equal(source.includes('latitude: "41.8189"'), true);
  assert.equal(source.includes("https://api.weather.gov/points/41.8506,-87.7937"), true);
  assert.equal(source.includes("https://weather.com/us/illinois/city/berwyn/today"), true);
});

test("operations board cycles title, today, next four hours, and tomorrow", async () => {
  const source = await readFile(new URL("../app/operations-board.tsx", import.meta.url), "utf8");
  assert.equal(source.includes('["title", "today", "hourly", "tomorrow"]'), true);
  assert.match(source, /Today’s Berwyn weather/);
  assert.match(source, /Next 4 hours/);
  assert.match(source, /Berwyn hourly outlook/);
  assert.match(source, /Tomorrow’s Berwyn weather/);
});
