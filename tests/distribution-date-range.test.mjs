import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { PGlite } from '@electric-sql/pglite';

test('distribution requires valid dates and includes only open positions inside both boundaries', async () => {
  const source = fs.readFileSync(new URL('../app/api/station-scheduler/route.ts', import.meta.url), 'utf8');
  const ast = ts.createSourceFile('route.ts', source, ts.ScriptTarget.Latest, true);
  const fn = ast.statements.find(s => ts.isFunctionDeclaration(s) && s.name?.text === 'runAutoDistribution');
  const pg = new PGlite();
  try {
    await pg.exec(`CREATE TABLE station_shift_types(id text,start_time text,end_time text);
      CREATE TABLE station_schedule_entries(id text,entry_date text,shift_type_id text);
      CREATE TABLE station_shift_slots(id text,entry_id text,role text,status text,start_time text,end_time text,sort_order int);
      INSERT INTO station_shift_types VALUES('day','06:00','12:00');
      INSERT INTO station_schedule_entries VALUES('before','2026-09-09','day'),('start','2026-09-10','day'),('end','2026-09-12','day'),('after','2026-09-13','day');
      INSERT INTO station_shift_slots SELECT id,id,'FF/Attendant','open','','',0 FROM station_schedule_entries;
      INSERT INTO station_shift_slots VALUES('filled','start','FF/Attendant','filled','','',1);`);
    let selected = [], reads = 0;
    const db = {prepare(sql) { let values=[]; const statement={bind(...v){values=v;return statement;},async first(){return null;},async all(){reads++;if(!sql.includes('FROM station_shift_slots'))return {results:[]};let i=0;const result=await pg.query(sql.replaceAll('?',()=>`$${++i}`).replace(/\b(entryDate|startTime|endTime)\b/g,'"$1"'),values);return {results:result.rows};}};return statement;}};
    const sandbox={exports:{},iso:/^\d{4}-\d{2}-\d{2}$/,chicagoToday:()=> '2026-09-09',loadEmployees:async()=>[],shiftHours:()=>6,busyEmployeesByDate:async()=>({}),autoDistribute:(slots)=>{selected=slots.map(s=>s.slotId);return [];},ok:v=>({status:200,...v}),bad:error=>({status:400,error})};
    vm.runInNewContext(ts.transpileModule(fn.getText(ast)+'\nexports.run=runAutoDistribution;', {compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,sandbox);
    const run=payload=>sandbox.exports.run(db,payload,()=>{});
    for(const payload of [{},{fromDate:'2026-09-10'},{fromDate:'2026-09-12',endDate:'2026-09-10'},{fromDate:'2026-02-30',endDate:'2026-03-01'}])assert.equal((await run(payload)).status,400);
    assert.equal(reads,0,'invalid requests do not query assignments');
    assert.equal((await run({fromDate:'2026-09-10',endDate:'2026-09-12'})).status,200);
    assert.deepEqual(Array.from(selected),['start','end']);
    await run({fromDate:'2026-09-12',endDate:'2026-09-12'});
    assert.deepEqual(Array.from(selected),['end']);
    await assert.rejects(sandbox.exports.run(db,{},()=>{throw Error('admin only')}),/admin only/);
  } finally { await pg.close(); }
});
