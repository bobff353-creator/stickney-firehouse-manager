import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const route = fs.readFileSync("app/api/health/route.ts", "utf8");

test("public health reports only browser-safe deployment coordinates", () => {
  assert.match(route, /getPublicSupabaseConfig/);
  assert.match(route, /supabaseProjectRef/);
  assert.match(route, /VERCEL_GIT_COMMIT_SHA/);
  assert.match(route, /private, no-store/);
  assert.match(route, /nosniff/);
  assert.doesNotMatch(route, /SUPABASE_SECRET_KEY|FIREHOUSE_DATABASE_SECRET|DATABASE_URL|publishableKey|\bkey\b/);
});

test("health accepts only the standard Supabase project hostname", () => {
  assert.match(route, /\^\(\[a-z0-9\]\{20\}\)\\\.supabase\\\.co\$/);
  assert.match(route, /unrecognized/);
  assert.doesNotMatch(route, /return url|supabaseUrl/);
});
