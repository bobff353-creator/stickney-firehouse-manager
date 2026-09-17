import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parseSavedTime,savedTimeLabel,operationalStatusLabel,checkNextAction,hydrantLocationLabel,responseFreshness} from '../app/workflow-status.ts';
import {groupStaffingAssignments} from '../app/staffing-display.ts';

test('saved times accept PostgreSQL offsets, UTC and legacy SQLite without adding a second timezone',()=>{
  for(const stamp of ['2026-09-17 15:04:06.89538+00','2026-09-17T15:04:06.895Z','2026-09-17 15:04:06.895+0000','2026-09-17 15:04:06.895+00:00','2026-09-17 10:04:06.895-05']) assert.equal(parseSavedTime(stamp)?.toISOString(),'2026-09-17T15:04:06.895Z');
  assert.equal(parseSavedTime('2026-09-17 15:04:06')?.toISOString(),'2026-09-17T15:04:06.000Z');
  assert.equal(savedTimeLabel('2026-09-17 15:04:06.89538+00'),'10:04 AM');
  for(const invalid of ['',null,undefined,{},'wrong',new Date(NaN),'2026-09-17 99:99:99']) {assert.equal(parseSavedTime(invalid),null);assert.equal(savedTimeLabel(invalid),'Time unavailable');}
});
test('operational status and review labels are plain language without false completion',()=>{
  assert.equal(operationalStatusLabel('out_of_service'),'Out of service');
  assert.equal(operationalStatusLabel(''),'Status not reported');
  assert.equal(checkNextAction(false,3,3),'Start check');
  assert.equal(checkNextAction(true,3,1),'Resume check');
  assert.equal(checkNextAction(true,3,0),'Review & submit');
  assert.equal(checkNextAction(true,0,0),'View checklist');
});
test('missing hydrant addresses use saved coordinates, not a made-up street',()=>{
  assert.equal(hydrantLocationLabel({address:' 4452 Grove Ave ',hydrantNumber:'94'}),'4452 Grove Ave');
  assert.equal(hydrantLocationLabel({address:'',hydrantNumber:'94',latitude:41.815,longitude:-87.78}),'Hydrant 94 · 41.81500, -87.78000');
  assert.match(hydrantLocationLabel({latitude:91,longitude:190}),/Map position unavailable/);
  assert.match(hydrantLocationLabel({latitude:NaN,longitude:0}),/Map position unavailable/);
});
test('freshness uses successful receipt, not browser online or age of a quiet incident',()=>{
  const now=Date.parse('2026-09-17T16:00:00Z');
  assert.equal(responseFreshness(new Date(now-300000),now,true,true,false).warning,false);
  assert.equal(responseFreshness(new Date(now-360001),now,true,true,false).warning,true);
  assert.equal(responseFreshness(new Date(now-45001),now,true,false,false).warning,true);
  assert.equal(responseFreshness(null,now,true,true,false).warning,true);
  assert.equal(responseFreshness(new Date(now),now,false,true,false).warning,true);
  assert.match(responseFreshness(new Date(now),now,true,true,true).label,/interrupted/);
});
test('staffing presentation groups only the same employee and exact shift while retaining source assignments',()=>{
  const one={id:'s1',employeeId:'e1',workDate:'2026-09-17',startTime:'06:00',endTime:'12:00',role:'Driver'};
  const records=[one,{...one,id:'s2',role:'Engine Driver'},{...one,id:'s3',employeeId:'e2'},{...one,id:'s4',startTime:'12:00',endTime:'18:00'},{...one,id:'s5',workDate:'2026-09-18'}];
  const before=JSON.stringify(records), grouped=groupStaffingAssignments(records);
  assert.equal(grouped.length,4);assert.equal(grouped[0].assignmentCount,2);assert.deepEqual(grouped[0].roles,['Driver','Engine Driver']);assert.equal(JSON.stringify(records),before);
  assert.equal(groupStaffingAssignments([{...one,employeeId:null},{...one,id:'s2',employeeId:null}]).length,2);
});
test('completion and safe navigation remain distinct from saves',()=>{
  const log=fs.readFileSync('app/daily-log.tsx','utf8'), guide=fs.readFileSync('app/portal-wayfinding.tsx','utf8'), inv=fs.readFileSync('app/inventory-operations.tsx','utf8'), respond=fs.readFileSync('app/respond.tsx','utf8');
  assert.match(log,/const updatedAt = data.log\?\.updatedAt;\s+const serverUpdatedAt = parseSavedTime\(updatedAt\)/);
  assert.match(log,/useWorkspaceViewState\("daily-log-date"/);
  assert.match(log,/Review &amp; hand off/);
  assert.match(log,/disabled=\{saving \|\| dirty \|\| saveError \|\| !isOnline\}/);
  assert.match(guide,/returnLabel && onReturn \? onReturn : onBack/);
  assert.doesNotMatch(guide,/onNavigate\(home\)/);
  assert.match(inv,/id="check-completion"/);assert.match(inv,/action: "complete_check"/);
  assert.match(respond,/Upstream CAD connection is not independently verified/);
  assert.match(respond,/responseFreshness\(lastRefresh/);
});
test('personal next shift is server-scoped and not queried by always-on boards',()=>{
  const route=fs.readFileSync('app/api/dashboard/route.ts','utf8');
  assert.match(route,/if \(!liveBoard\) \{\s+const email = request.headers.get\("oai-authenticated-user-email"\)/);
  assert.match(route,/people.results.length === 1/);
  assert.doesNotMatch(route,/searchParams.get\("employeeId"\)/);
});
