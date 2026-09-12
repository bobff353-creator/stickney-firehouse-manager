import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

async function loadProgressModule() {
  const deviceSource = await readFile(new URL("../app/respond-device.ts", import.meta.url), "utf8");
  const deviceOutput = ts.transpileModule(deviceSource, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  const deviceUrl = `data:text/javascript;base64,${Buffer.from(deviceOutput).toString("base64")}`;
  const source = await readFile(
    new URL("../app/respond-progress.ts", import.meta.url),
    "utf8",
  );
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText.replace('"./respond-device"', JSON.stringify(deviceUrl));
  return import(
    `data:text/javascript;base64,${Buffer.from(output).toString("base64")}`
  );
}

const scope = (reportNumber = "INC-100", apparatus = "1204", departmentId = "fixture-a") => ({ reportNumber, apparatus, departmentId });

test("response progress is scoped to the incident and apparatus device", async () => {
  const { readRespondProgress, writeRespondProgress } =
    await loadProgressModule();
  const values = new Map();
  const store = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };

  writeRespondProgress(
    store,
    scope(),
    "en_route",
    "2026-08-30T12:00:00.000Z",
  );

  assert.deepEqual(readRespondProgress(store, scope()), {
    status: "en_route",
    updatedAt: "2026-08-30T12:00:00.000Z",
  });
  assert.equal(readRespondProgress(store, scope("INC-100", "1205")), null);
  assert.equal(readRespondProgress(store, scope("INC-200")), null);
  assert.equal(readRespondProgress(store, scope("INC-100", "1204", "fixture-b")), null);
});

test("invalid or damaged saved progress fails closed", async () => {
  const { readRespondProgress, RESPOND_PROGRESS_STORAGE_KEY } =
    await loadProgressModule();
  const store = {
    getItem: () => "not-json",
    setItem: () => undefined,
  };
  assert.equal(readRespondProgress(store, scope()), null);

  const invalidStore = {
    getItem: (key) =>
      key === RESPOND_PROGRESS_STORAGE_KEY
        ? JSON.stringify({ "INC-100::1204": { status: "cleared" } })
        : null,
    setItem: () => undefined,
  };
  assert.equal(readRespondProgress(invalidStore, scope()), null);
});

test("completed response actions disappear and cancellation remains last", async () => {
  const { nextRespondActions } = await loadProgressModule();
  assert.deepEqual(nextRespondActions(), ["acknowledged", "en_route", "on_scene"]);
  assert.deepEqual(nextRespondActions("acknowledged"), ["en_route", "on_scene", "canceled"]);
  assert.deepEqual(nextRespondActions("en_route"), ["on_scene", "canceled"]);
  assert.deepEqual(nextRespondActions("on_scene"), ["cleared_scene", "canceled"]);
  assert.deepEqual(nextRespondActions("cleared_scene"), ["in_service_on_air", "returning_to_quarters", "canceled"]);
  for (const status of ["in_service_on_air", "returning_to_quarters", "canceled"]) assert.deepEqual(nextRespondActions(status), []);
});

test("new progress states survive reloading storage without changing other incidents", async () => {
  const { readRespondProgress, writeRespondProgress } = await loadProgressModule();
  const values = new Map();
  const store = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  for (const status of ["cleared_scene", "in_service_on_air", "returning_to_quarters", "canceled"]) {
    writeRespondProgress(store, scope("TEST", "UNIT"), status);
    assert.equal(readRespondProgress(store, scope("TEST", "UNIT")).status, status);
    assert.equal(readRespondProgress(store, scope("OTHER", "UNIT")), null);
  }
});

test("failed browser storage is reported instead of pretending progress was saved", async () => {
  const { writeRespondProgress } = await loadProgressModule();
  assert.throws(() => writeRespondProgress({ getItem: () => null, setItem: () => { throw new Error("Storage unavailable"); } }, scope(), "on_scene"), /Storage unavailable/);
});

test("progress requires a matching apparatus-filtered call, not just an apparatus preference", async () => {
  const { assignedRespondProgressScope } = await loadProgressModule();
  const packet = { departmentId: "fixture-a", apparatusFilter: "1204", activeCall: { reportNumber: "INC-100", respondingUnits: "1201, 1204 / B11" } };
  assert.deepEqual(assignedRespondProgressScope("1204", packet), scope());
  assert.deepEqual(assignedRespondProgressScope(" 1204 ", packet), scope());
  for (const unit of ["", " ", "12040", "1205"]) assert.equal(assignedRespondProgressScope(unit, packet), null);
  for (const change of [{departmentId:""}, {apparatusFilter:null}, {apparatusFilter:"1205"}, {activeCall:null}, {activeCall:{reportNumber:"",respondingUnits:"1204"}}, {activeCall:{reportNumber:"INC-100",respondingUnits:"12040 E1204"}}]) {
    assert.equal(assignedRespondProgressScope("1204", {...packet,...change}), null);
  }
});

test("unscoped and legacy browser progress is never attributed to an apparatus", async () => {
  const { readRespondProgress, writeRespondProgress, RESPOND_PROGRESS_STORAGE_KEY } = await loadProgressModule();
  const legacy = JSON.stringify({"INC-100::portal":{status:"on_scene"}, "INC-100::1204":{status:"en_route"}});
  const values = new Map([["stickney-respond-progress-v1", legacy]]);
  const store = {getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)};
  assert.equal(readRespondProgress(store, scope()), null);
  for (const invalid of [null,scope(""),scope("INC-100",""),scope("INC-100","1204","")]) {
    assert.equal(readRespondProgress(store, invalid), null);
    assert.throws(()=>writeRespondProgress(store,invalid,"en_route"));
  }
  assert.equal(values.has(RESPOND_PROGRESS_STORAGE_KEY), false);
  assert.equal(values.get("stickney-respond-progress-v1"), legacy);
});

test("local progress history is bounded and rejects malformed values", async () => {
  const { readRespondProgress, writeRespondProgress, respondProgressKey, RESPOND_PROGRESS_STORAGE_KEY, RESPOND_PROGRESS_LIMIT } = await loadProgressModule();
  const values = new Map();
  const store = {getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)};
  for(let i=0;i<120;i++)writeRespondProgress(store,scope(`CALL-${i}`),"en_route",new Date(1700000000000+i*1000).toISOString());
  assert.equal(Object.keys(JSON.parse(values.get(RESPOND_PROGRESS_STORAGE_KEY))).length,RESPOND_PROGRESS_LIMIT);
  assert.equal(readRespondProgress(store,scope("CALL-0")),null);
  assert.equal(readRespondProgress(store,scope("CALL-119")).status,"en_route");
  for(const malformed of [null,[],{status:"bad",updatedAt:new Date().toISOString()},{status:"on_scene",updatedAt:"invalid"}]) {
    values.set(RESPOND_PROGRESS_STORAGE_KEY,JSON.stringify({[respondProgressKey(scope())]:malformed}));
    assert.equal(readRespondProgress(store,scope()),null);
  }
});

test("Respond gates both rendering and writes, isolates scope switches, and keeps polling unchanged", async () => {
  const source = await readFile(new URL("../app/respond.tsx",import.meta.url),"utf8");
  assert.match(source,/progressScope && <div className="respond-progress-panel"/);
  assert.match(source,/if \(!canUpdateProgress \|\| !progressScope\) return/);
  assert.match(source,/savedCrewProgress\?\.key === progressScopeKey/);
  assert.match(source,/disabled=\{!canUpdateProgress\}/);
  assert.match(source,/window\.addEventListener\("storage", onStorage\)/);
  assert.match(source,/window\.removeEventListener\("storage", onStorage\)/);
  assert.match(source,/setInterval\(\(\) => void load\(\), 10000\)/);
});
