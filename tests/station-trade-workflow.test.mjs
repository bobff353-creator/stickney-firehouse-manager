import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { webcrypto } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';

// Execute actual route functions with an isolated PostgreSQL database.
// Authentication transport is not exercised; no live records or credentials are used.
const source = fs.readFileSync(new URL('../app/api/station-scheduler/route.ts', import.meta.url),'utf8');
const ast = ts.createSourceFile('route.ts',source,ts.ScriptTarget.Latest,true);
const names = ['submitTrade','respondTrade','reviewTrade','tradeSlot','validateTradePair'];
const selected = ast.statements.filter(s=>ts.isFunctionDeclaration(s)&&names.includes(s.name?.text)).map(s=>s.getText(ast)).join('\n');
const migration = fs.readFileSync(new URL('../supabase/migrations/20260908035659_station_trade_swaps.sql',import.meta.url),'utf8');
async function fixture() {
  const pg = new PGlite();
  await pg.exec(`CREATE SCHEMA firehouse; SET search_path=firehouse;
    CREATE TABLE employees(id text PRIMARY KEY,active int,pay_scale_id text);
    CREATE TABLE pay_scales(id text PRIMARY KEY,label text);
    CREATE TABLE employee_profiles(employee_id text,end_date text,station_roles text,acting_officer_eligible int);
    CREATE TABLE station_shift_types(id text PRIMARY KEY,start_time text,end_time text);
    CREATE TABLE station_schedule_entries(id text PRIMARY KEY,entry_date text,shift_type_id text);
    CREATE TABLE station_shift_slots(id text PRIMARY KEY,entry_id text,employee_id text,role text,status text,start_time text,end_time text);
    CREATE TABLE station_trade_requests(id text PRIMARY KEY,slot_id text,role text,from_employee_id text,target_employee_id text,accepted_by_employee_id text,note text,status text,reviewed_by text,reviewed_at text);
    INSERT INTO pay_scales VALUES('ff','Firefighter');
    INSERT INTO employees VALUES('a',1,'ff'),('b',1,'ff'),('c',1,'ff');
    INSERT INTO employee_profiles SELECT id,'','["FF/Attendant"]',0 FROM employees;
    INSERT INTO station_shift_types VALUES('day','06:00','18:00');
    INSERT INTO station_schedule_entries VALUES('d1','2099-01-02','day'),('d2','2099-01-03','day');
    INSERT INTO station_shift_slots VALUES('s1','d1','a','FF/Attendant','filled','',''),('s2','d2','b','FF/Attendant','filled','','');`);
  await pg.exec(migration);
  const db = {
    failSlot: null,
    prepare(sql) {
      let values=[]; let expected;
      const statement={bind(...v){values=v;return statement;},expectChanges(n){expected=n;return statement;},
        async execute(){
          if(db.failSlot && sql.startsWith('UPDATE station_shift_slots') && values.includes(db.failSlot)) throw new Error('simulated write failure');
          let i=0;
          const query=sql.replaceAll('?',()=>`$${++i}`).replace(/\b(slotId|returnSlotId|employeeId|entryDate|startTime|endTime|fromEmployeeId|targetEmployeeId|acceptedByEmployeeId|actingOfficerEligible)\b/g,'"$1"');
          const result=await pg.query(query,values);
          if(expected!==undefined && result.affectedRows!==expected) throw new Error('SAVE_CONFLICT');
          return result;
        },async first(){return (await statement.execute()).rows[0]??null;},async run(){return statement.execute();}};
      return statement;
    },
    async batch(statements){await pg.exec('BEGIN');try{for(const s of statements)await s.run();await pg.exec('COMMIT');}catch(e){await pg.exec('ROLLBACK');throw e;}}
  };
  const members=['a','b','c'].map(id=>({id,roles:'["FF/Attendant"]',rank:'Firefighter',actingOfficerEligible:0}));
  const sandbox={exports:{},crypto:webcrypto,ok:(body={})=>({status:200,...body}),bad:(error,status=400)=>({status,error}),
    chicagoToday:()=> '2099-01-01',parseRoles:JSON.parse,eligibleForRole:(role,e)=>e.roles.includes(role),isGeneralOneDayPosition:role=>['Firefighter','Training/Orientation'].includes(role),
    isSchedulableEmployee:async(_,id)=>members.some(e=>e.id===id),loadEmployees:async()=>members,isExplicitlyUnavailable:async()=>false};
  vm.runInNewContext(ts.transpileModule(selected+'\nexports.handlers={submitTrade,respondTrade,reviewTrade};',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,sandbox);
  const h=sandbox.exports.handlers;
  const owner={employeeId:'a',name:'Owner'},recipient={employeeId:'b',name:'Recipient'},admin={employeeId:'c',name:'Admin'};
  const post=async(swap=true,target='b')=>{
    const result=await h.submitTrade(db,owner,{slotId:'s1',targetEmployeeId:target,tradeKind:swap?'swap':'giveaway',returnSlotId:swap?'s2':null});
    assert.equal(result.status,200,JSON.stringify(result));
    return (await pg.query('SELECT id FROM station_trade_requests')).rows[0].id;
  };
  const owners=async()=> (await pg.query('SELECT employee_id FROM station_shift_slots ORDER BY id')).rows.map(r=>r.employee_id);
  return {pg,db,h,owner,recipient,admin,post,owners};
}
test('swap requires member acceptance; only approval changes both calendar slots',async()=>{
  const f=await fixture();try{
    const id=await f.post();
    assert.equal((await f.h.reviewTrade(f.db,f.admin,{id,decision:'approved'},()=>{})).status,409);
    assert.deepEqual(await f.owners(),['a','b']);
    assert.equal((await f.h.respondTrade(f.db,f.recipient,{id,decision:'accept'})).status,200);
    assert.deepEqual(await f.owners(),['a','b']);
    assert.equal((await f.h.reviewTrade(f.db,f.admin,{id,decision:'approved'},()=>{})).status,200);
    assert.deepEqual(await f.owners(),['b','a']);
    assert.equal((await f.h.reviewTrade(f.db,f.admin,{id,decision:'approved'},()=>{})).status,409);
  }finally{await f.pg.close();}
});
test('giveaway changes one slot; admin cannot impersonate a directed recipient',async()=>{
  const f=await fixture();try{
    const id=await f.post(false);
    assert.equal((await f.h.respondTrade(f.db,f.admin,{id,employeeId:'b',decision:'accept'})).status,403);
    await f.h.respondTrade(f.db,f.recipient,{id,decision:'accept'});
    await f.h.reviewTrade(f.db,f.admin,{id,decision:'approved'},()=>{});
    assert.deepEqual(await f.owners(),['b','b']);
  }finally{await f.pg.close();}
});
test('a second write failure rolls back approval and both assignments',async()=>{
  const f=await fixture();try{
    const id=await f.post();await f.h.respondTrade(f.db,f.recipient,{id,decision:'accept'});
    f.db.failSlot='s2';
    await assert.rejects(f.h.reviewTrade(f.db,f.admin,{id,decision:'approved'},()=>{}),/simulated/);
    assert.deepEqual(await f.owners(),['a','b']);
    assert.equal((await f.pg.query('SELECT status FROM station_trade_requests')).rows[0].status,'awaiting_acceptance');
  }finally{await f.pg.close();}
});
test('duplicate offers and replacement acceptance are rejected',async()=>{
  const f=await fixture();try{
    const id=await f.post(false,'');
    await assert.rejects(f.h.submitTrade(f.db,f.owner,{slotId:'s1'}),/already has an open/);
    await f.h.respondTrade(f.db,f.recipient,{id,decision:'accept'});
    assert.equal((await f.h.respondTrade(f.db,f.admin,{id,decision:'accept'})).status,409);
    assert.equal((await f.pg.query('SELECT accepted_by_employee_id FROM station_trade_requests')).rows[0].accepted_by_employee_id,'b');
  }finally{await f.pg.close();}
});
test('changed return ownership prevents approval without partial changes',async()=>{
  const f=await fixture();try{
    const id=await f.post();await f.h.respondTrade(f.db,f.recipient,{id,decision:'accept'});
    await f.pg.exec("UPDATE station_shift_slots SET employee_id='c' WHERE id='s2'");
    assert.equal((await f.h.reviewTrade(f.db,f.admin,{id,decision:'approved'},()=>{})).status,409);
    assert.deepEqual(await f.owners(),['a','c']);
  }finally{await f.pg.close();}
});
test('swap cannot be broadcast or omit the return shift',async()=>{
  const f=await fixture();try{
    assert.equal((await f.h.submitTrade(f.db,f.owner,{slotId:'s1',tradeKind:'swap',targetEmployeeId:'b'})).status,400);
    assert.equal((await f.h.submitTrade(f.db,f.owner,{slotId:'s1',tradeKind:'swap',returnSlotId:'s2'})).status,400);
    assert.equal((await f.pg.query('SELECT count(*)::int AS n FROM station_trade_requests')).rows[0].n,0);
  }finally{await f.pg.close();}
});
test('non-admin review and member decline never change assignments',async()=>{
  const f=await fixture();try{
    const id=await f.post();
    await assert.rejects(f.h.reviewTrade(f.db,f.owner,{id,decision:'approved'},()=>{throw new Error('Admin required');}),/Admin required/);
    await f.h.respondTrade(f.db,f.recipient,{id,decision:'decline'});
    assert.deepEqual(await f.owners(),['a','b']);
    assert.equal((await f.pg.query('SELECT status FROM station_trade_requests')).rows[0].status,'denied');
  }finally{await f.pg.close();}
});
