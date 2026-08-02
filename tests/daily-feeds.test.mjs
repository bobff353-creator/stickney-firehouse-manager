import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("refreshes Firefighter Close Calls from the official RSS feed", async () => {
  const [feeds, route] = await Promise.all([
    read("app/lib/external-feeds.ts"),
    read("app/api/close-call-news/route.ts"),
  ]);

  assert.match(
    feeds,
    /https:\/\/www\.firefighterclosecalls\.com\/category\/news\/feed\//,
  );
  assert.match(feeds, /wp-json\/wp\/v2\/posts\?categories=1/);
  assert.match(feeds, /hostname !== "www\.firefighterclosecalls\.com"/);
  assert.match(feeds, /\.slice\(0, 6\)/);
  assert.match(feeds, /revalidate: 86_400/);
  assert.match(route, /getCloseCallNews/);
  assert.doesNotMatch(route, /fallbackItems|FIREFIGHTER DIES|SAMPLE/i);
});

test("checks each official training provider daily", async () => {
  const [feeds, bridge, proxy] = await Promise.all([
    read("app/lib/external-feeds.ts"),
    read("public/training-route.js"),
    read("app/[[...path]]/route.ts"),
  ]);

  for (const source of [
    "www.romeoville.org/562/Fire-Rescue-Courses",
    "www.fsi.illinois.edu/content/courses/schedule/",
    "nipsta.org/175/Fire-Technical-Rescue-Training",
  ]) {
    assert.match(feeds, new RegExp(source.replaceAll(".", "\\.")));
  }
  assert.match(bridge, /fetch\("\/api\/training-sites"/);
  assert.match(bridge, /MutationObserver/);
  assert.match(bridge, /Official site checked/);
  assert.match(bridge, /provider\.upcoming\.slice\(0, 6\)/);
  assert.match(bridge, /heading\.closest\("\.rotating-panel"\)/);
  assert.match(feeds, /parseRomeovilleActivity/);
  assert.match(feeds, /parseIfsiSchedule/);
  assert.match(feeds, /parseNipstaEvents/);
  assert.match(feeds, /stickney-training-sites-v2/);
  assert.match(proxy, /training-route\.js\?v=20260802-2/);
});

test("protects and schedules the daily refresh", async () => {
  const [cron, config] = await Promise.all([
    read("app/api/cron/daily-refresh/route.ts"),
    read("vercel.json"),
  ]);

  assert.match(cron, /process\.env\.CRON_SECRET/);
  assert.match(
    cron,
    /request\.headers\.get\("authorization"\) !== `Bearer \$\{cronSecret\}`/,
  );
  assert.match(cron, /revalidateTag\(externalFeedCacheTag/);
  assert.match(cron, /upcomingTrainingItems/);
  assert.match(config, /"path": "\/api\/cron\/daily-refresh"/);
  assert.match(config, /"schedule": "15 9 \* \* \*"/);
});
