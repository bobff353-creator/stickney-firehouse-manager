import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const route=fs.readFileSync(new URL("../app/api/field-preplans/operational/route.ts",import.meta.url),"utf8");
const panel=fs.readFileSync(new URL("../app/preplans/operational-panel.tsx",import.meta.url),"utf8");

test("expiring-record review is permission gated and preplan scoped",()=>{
  assert.match(route,/action==="reviewExpiringRecord"/);
  assert.match(route,/field_preplans\.verify_expiring/);
  assert.match(route,/WHERE id=\? AND preplan_id=\?/);
  assert.match(route,/A valid expiring record action is required/);
  assert.match(route,/The selected expiring record was not found in this preplan/);
});

test("expiration actions verify, extend, resolve, and archive without automatic deletion",()=>{
  assert.match(route,/\["verify","extend","resolve","archive"\]\.includes\(decision\)/);
  assert.match(route,/Expiration may be extended from 1 to 365 days/);
  assert.match(route,/SET expires_at=NULL/);
  assert.match(route,/SET archived=1/);
  assert.doesNotMatch(route.match(/if\(action==="reviewExpiringRecord"\)[\s\S]*?return Response\.json\(\{ok:true,id,kind,decision\}\);/)?.[0]??"",/DELETE FROM/);
  assert.match(route,/expiration_\$\{decision\}_\$\{kind\}/);
});

test("Field Preplans exposes a truthful review queue with explicit actions",()=>{
  assert.match(panel,/Expiring items/);
  assert.match(panel,/Verify ongoing/);
  assert.match(panel,/Extend 30 days/);
  assert.match(panel,/Resolve/);
  assert.match(panel,/Archive/);
  assert.match(panel,/Expired records are never automatically deleted/);
  assert.match(panel,/No operational records expire within 30 days/);
});

test("alert date controls persist input events and authorized alerts can be archived",()=>{
  assert.match(panel,/type="datetime-local" value=\{form\.effectiveAt\} onInput=/);
  assert.match(panel,/type="datetime-local" value=\{form\.expiresAt\} onInput=/);
  assert.match(panel,/field_preplans\.verify_expiring/);
  assert.match(panel,/Archive alert/);
  assert.match(panel,/kind:"alert"/);
});
