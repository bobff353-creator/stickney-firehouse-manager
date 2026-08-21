import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const cache = fs.readFileSync("app/preplans/offline-cache.ts", "utf8");
const respond = fs.readFileSync("app/respond.tsx", "utf8");
const route = fs.readFileSync("app/api/respond/route.ts", "utf8");
const auth = fs.readFileSync("app/auth-gateway.tsx", "utf8");

test("Respond packets use a versioned IndexedDB store scoped by department and apparatus", () => {
  assert.match(cache, /RESPOND_STORE_NAME = "respond-packets"/);
  assert.match(cache, /DATABASE_VERSION = 2/);
  assert.match(cache, /`\$\{departmentId\}:\$\{apparatus \|\| "all"\}`/);
  assert.match(cache, /cached\.departmentId !== entry\.departmentId/);
  assert.match(route, /departmentId/);
});

test("only matched active published response packets are cached and idle clears stale calls", () => {
  assert.match(
    respond,
    /body\.activeCall && body\.preplan && body\.departmentId/,
  );
  assert.match(respond, /cacheRespondPacket/);
  assert.match(
    respond,
    /removeCachedRespondPacket\(body\.departmentId, apparatus\)/,
  );
  assert.match(respond, /isCachedRespondData/);
});

test("offline Respond is explicitly read-only and timestamped", () => {
  assert.match(respond, /OFFLINE — READ-ONLY PREPLAN/);
  assert.match(respond, /saved at/);
  assert.match(respond, /may not reflect current conditions/);
  assert.match(respond, /OFFLINE — NO MATCHED PREPLAN CACHE/);
});

test("sign-out clears private Respond packets", () => {
  assert.match(auth, /SIGNED_OUT/);
  assert.match(auth, /clearCachedRespondPackets/);
});
