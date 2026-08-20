import assert from "node:assert/strict";
import test from "node:test";
import { calculateControllingFireFlow, calculateHoseLay, calculateTargetHazard, lifecycleState, matchCadRoom, normalizedLevelLabel, polygonAreaSquareFeet } from "../app/preplans/domain.ts";

test("preplan lifecycle compares valid instants instead of mixing text and dates", () => {
  const now = new Date("2026-08-20T12:00:00Z");
  assert.equal(lifecycleState({ effectiveAt:"2026-08-21T12:00:00Z" }, now), "scheduled");
  assert.equal(lifecycleState({ expiresAt:"2026-08-19T12:00:00Z" }, now), "expired");
  assert.equal(lifecycleState({ expiresAt:"2026-08-25T12:00:00Z" }, now, 30), "expiring");
  assert.equal(lifecycleState({}, now), "active");
});

test("levels, polygons, and hose lays are deterministic", () => {
  assert.equal(normalizedLevelLabel(" Basement  1 "), "BASEMENT-1");
  assert.equal(polygonAreaSquareFeet([{lat:41.8,lng:-87.77},{lat:41.8,lng:-87.7699},{lat:41.8001,lng:-87.7699},{lat:41.8001,lng:-87.77}]) > 0, true);
  assert.deepEqual(calculateHoseLay({totalDistanceFeet:245,sectionLengthFeet:100,reserveFeet:100,apparatusCapacityFeet:400}), {
    workingFeet:345, sections:4, recommendedFeet:400, withinApparatusCapacity:true,
  });
});

test("target hazard scoring is explainable and bounded", () => {
  assert.deepEqual(calculateTargetHazard([
    {factor:"lightweight truss",score:35,explanation:"Early collapse concern",source:"construction survey"},
    {factor:"hazmat",score:25,explanation:"Oxidizer storage",source:"site survey"},
  ]), { score:60, level:"high", reasons:["lightweight truss: Early collapse concern","hazmat: Oxidizer storage"] });
});

test("fire-area planning keeps code flow separate from sprinkler demand plus hose allowance",()=>{
  const result=calculateControllingFireFlow([
    {id:"a",name:"Warehouse",codeFireFlowGpm:2500,sprinklerDemandGpm:1500,hoseAllowanceGpm:500,separationVerified:true},
    {id:"b",name:"Office",codeFireFlowGpm:1000,sprinklerDemandGpm:900,hoseAllowanceGpm:500,separationVerified:false},
  ]);
  assert.equal(result.controllingGpm,2500);assert.equal(result.controllingAreaId,"a");
  assert.equal(result.areas[1].requiredGpm,1400);assert.deepEqual(result.warnings,["Office: fire-area separation is not verified"]);
});

test("CAD room matching rejects ambiguity", () => {
  const rooms = [{id:"1",name:"Electrical Room",aliases:["electric room"]},{id:"2",name:"Boiler Room",aliases:["boiler"]}];
  assert.equal(matchCadRoom("ALARM - ELECTRIC ROOM", rooms).room?.id, "1");
  assert.equal(matchCadRoom("unknown lobby", rooms).room, null);
  assert.equal(matchCadRoom("room", rooms).room, null);
});
