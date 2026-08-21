import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { constructionProfile, hasConstructionProfile, hasOccupancyProfile, occupancyProfile } from "../app/preplans/profiles.ts";

const route=fs.readFileSync(new URL("../app/api/field-preplans/operational/route.ts",import.meta.url),"utf8");
const panel=fs.readFileSync(new URL("../app/preplans/operational-panel.tsx",import.meta.url),"utf8");
const respondRoute=fs.readFileSync(new URL("../app/api/respond/route.ts",import.meta.url),"utf8");
const respond=fs.readFileSync(new URL("../app/respond.tsx",import.meta.url),"utf8");

test("construction profiles preserve unknown facts and bound counts",()=>{
  assert.deepEqual(constructionProfile({constructionType:" Type III ",bowstringTruss:"maybe",floorsAboveGrade:"2",floorsBelowGrade:-1}),{
    constructionType:"Type III",roofType:"",roofSupportSystem:"",lightweightConstruction:"unknown",bowstringTruss:"unknown",basementType:"",floorsAboveGrade:2,floorsBelowGrade:null,fortifiedAccess:"unknown",notes:"",
  });
  assert.equal(hasConstructionProfile(constructionProfile({})),false);
  assert.equal(hasConstructionProfile(constructionProfile({bowstringTruss:"yes"})),true);
});

test("occupancy profiles distinguish verified zero from missing information",()=>{
  const profile=occupancyProfile({classification:"School",daytimeOccupancy:0,peakOccupancy:"850",sleepingOccupants:"no"});
  assert.equal(profile.daytimeOccupancy,0);
  assert.equal(profile.nighttimeOccupancy,null);
  assert.equal(profile.peakOccupancy,850);
  assert.equal(hasOccupancyProfile(profile),true);
});

test("Field and Respond persist and consume the same structured profiles",()=>{
  assert.match(route,/saveConstructionProfile/);
  assert.match(route,/saveOccupancyProfile/);
  assert.match(route,/field_preplans\.edit/);
  assert.match(panel,/Unknown stays unknown/);
  assert.match(panel,/No verified structured construction profile is recorded/);
  assert.match(respondRoute,/construction:constructionProfile/);
  assert.match(respondRoute,/occupancy:occupancyProfile/);
  assert.match(respond,/VERIFIED CONSTRUCTION/);
  assert.match(respond,/VERIFIED OCCUPANCY/);
  assert.doesNotMatch(respond,/dangerouslySetInnerHTML/);
});
