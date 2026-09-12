import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const read = path => readFile(new URL("../"+path, import.meta.url),"utf8");
test("all public feed routes read saved data only; only cron imports external loaders",async()=>{
 for(const path of ["weather","close-call-news","usfa-fatalities","training-sites","board-feeds"]){
  const source=await read("app/api/"+path+"/route.ts");
  assert.match(source,/board-feed-response/);
  assert.doesNotMatch(source,/fetch\(|external-feeds|weather-source|usfa-source|unstable_cache/);
 }
 const board=await read("app/operations-board.tsx");
 assert.match(board,/useBoardFeeds\(tvMode\)/);
 assert.doesNotMatch(board,/\/api\/(weather|usfa-fatalities|close-call-news|training-sites)/);
 assert.match(board,/void load\(\), 30000/);
});
test("training providers and Close Calls sources are preserved without global DOM polling",async()=>{
 const feeds=await read("app/lib/external-feeds.ts");
 for(const token of ["firefighterclosecalls.com/category/news/feed/","wp-json/wp/v2/posts","loadTrainingProvider","parseRomeovilleActivity","parseIfsiSchedule","parseNipstaEvents"])assert.ok(feeds.includes(token),token);
 assert.doesNotMatch(feeds,/unstable_cache|revalidate:/);
 const layout=await read("app/layout.tsx");
 assert.doesNotMatch(layout,/training-route/);
 const board=await read("app/operations-board.tsx");
 assert.match(board,/provider\?\.upcoming/);
 assert.match(board,/\["romeoville", "ifsi", "nipsta"\]/);
});
test("signed cron preserves expiration job, quarter-hour scheduling, and narrowly bypasses member login",async()=>{
 const cron=await read("app/api/cron/board-feeds/route.ts");
 assert.match(cron,/process\.env\.CRON_SECRET/);
 assert.match(cron,/request\.headers\.get\('authorization'\) !== `Bearer \$\{secret\}`/);
 const config=JSON.parse(await read("vercel.json"));
 assert.ok(config.crons.some(job=>job.path==="/api/cron/board-feeds"&&job.schedule==="*/15 * * * *"));
 assert.ok(config.crons.some(job=>job.path==="/api/cron/daily-refresh"&&job.schedule==="15 9 * * *"));
 const daily=await read("app/api/cron/daily-refresh/route.ts");
 assert.match(daily,/evaluatePreplanExpirations/);assert.doesNotMatch(daily,/getTrainingSites|revalidateTag|external-feeds/);
 const proxy=await read("proxy.ts");assert.match(proxy,/signedCronRequest/);assert.match(proxy,/request.method === 'GET'/);
});
