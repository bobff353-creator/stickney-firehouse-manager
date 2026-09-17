import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import vm from 'node:vm';
import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { trainingModules } from './helpers/training-modules.mjs';

const load = trainingModules({ [resolve('app/supabase-server.ts')]: {} });
const consent = load('app/station-distribution.ts');
const logic = load('app/station-scheduler-logic.ts');
const position = { id:'slot', role:'FF/Attendant', entryDate:'2099-01-07', shiftTypeId:'red-1', startTime:'06:00',endTime:'12:00',shiftStartTime:'06:00',shiftEndTime:'12:00',anchorDate:'2099-01-01',repeatEveryDays:6,shiftActive:1,isExtra:0 };
const standing = {id:'standing',employeeId:'a',shiftTypeId:'red-1',role:'FF/Attendant',active:1};
const request = {id:'claim',slotId:'slot',employeeId:'a',role:'FF/Attendant',status:'pending'};

test('consent requires exact pending position request, never generic availability', () => {
  const check = (claims, changes={}) => consent.distributionConsent({...position,...changes},'a',claims,[]);
  assert.equal(check([]),null);
  assert.deepEqual(check([request]),{kind:'request',id:'claim'});
  for (const change of [{slotId:'other'},{employeeId:'other'},{role:'Engine Driver'},...['denied','approved','withdrawn','cancelled'].map(status=>({status}))]) assert.equal(check([{...request,...change}]),null);
  assert.equal(check([request],{shiftActive:0}),null);
});

test('all six saved groups match by ID, role, occurrence and hours, not just color/name', () => {
  for (const shiftTypeId of ['red-1','red-2','black-1','black-2','gold-1','gold-2']) {
    const slot={...position,shiftTypeId};
    assert.equal(consent.distributionConsent(slot,'a',[],[{...standing,shiftTypeId}])?.kind,'recurring');
    assert.equal(consent.distributionConsent(slot,'a',[],[{...standing,shiftTypeId:shiftTypeId+'-other'}]),null);
  }
  for (const change of [{entryDate:'2099-01-08'},{entryDate:'2098-12-31'},{repeatEveryDays:0},{anchorDate:''},{isExtra:1},{startTime:'07:00'},{endTime:'13:00'},{role:'Engine Driver'},{shiftActive:0}]) assert.equal(consent.distributionConsent({...position,...change},'a',[],[standing]),null,JSON.stringify(change));
  assert.equal(consent.distributionConsent(position,'a',[],[{...standing,active:0}]),null);
  assert.equal(consent.distributionConsent({...position,isExtra:1},'a',[request],[])?.kind,'request');
});

const source=fs.readFileSync(new URL('../app/api/station-scheduler/route.ts',import.meta.url),'utf8');
const ast=ts.createSourceFile('route.ts',source,ts.ScriptTarget.Latest,true);
const names=['runAutoDistribution','loadEmployees','parseRoles','eligibleForRole','busyEmployeesByDate','assignmentConflict','staffingConflict','isExplicitlyUnavailable'];
const selected=ast.statements.filter(s=>ts.isFunctionDeclaration(s)&&names.includes(s.name?.text)).map(s=>s.getText(ast)).join('\n');
const vars=['iso','timeMinutes','availabilityBlocksShift','shiftHours','isGeneralOneDayPosition'];
const selectedVars=ast.statements.filter(s=>ts.isVariableStatement(s)&&s.declarationList.declarations.some(d=>vars.includes(d.name.getText(ast)))).map(s=>s.getText(ast)).join('\n');

async function fixture() {
  const pg=new PGlite();
  await pg.exec(`CREATE TABLE pay_scales(id text PRIMARY KEY,label text);
    INSERT INTO pay_scales VALUES('ff','Firefighter');
    CREATE TABLE employees(id text PRIMARY KEY,name text,active int DEFAULT 1,pay_scale_id text DEFAULT 'ff');
    INSERT INTO employees(id,name) VALUES('a','First fixture'),('b','Second fixture'),('c','Third fixture');
    CREATE TABLE employee_profiles(employee_id text PRIMARY KEY,email text,phone text,station_roles text,start_date text,driver_status text,single_role int,acting_officer_eligible int,station_ot_hours real,station_mandatory_hours real,station_hours_this_period real DEFAULT 0,station_off_duty int,station_last_mandated text,station_consecutive_mandatory int,station_notify_email int,station_notify_text int,end_date text,updated_at text);
    INSERT INTO employee_profiles(employee_id) SELECT id FROM employees;
    CREATE TABLE station_shift_types(id text PRIMARY KEY,name text,start_time text,end_time text,active int DEFAULT 1,anchor_date text DEFAULT '2099-01-01',repeat_every_days int DEFAULT 6);
    INSERT INTO station_shift_types(id,name,start_time,end_time) VALUES('red-1','Red 1','06:00','12:00'),('red-2','Red 2','06:00','12:00');
    CREATE TABLE station_schedule_entries(id text PRIMARY KEY,entry_date text,shift_type_id text);
    INSERT INTO station_schedule_entries VALUES('day','2099-01-07','red-1');
    CREATE TABLE station_shift_slots(id text PRIMARY KEY,entry_id text,role text,status text DEFAULT 'open',employee_id text,start_time text DEFAULT '',end_time text DEFAULT '',is_extra int DEFAULT 0,sort_order int DEFAULT 0);
    INSERT INTO station_shift_slots(id,entry_id,role) VALUES('slot','day','FF/Attendant');
    CREATE TABLE station_shift_claims(id text PRIMARY KEY,slot_id text,employee_id text,role text,status text DEFAULT 'pending',reviewed_by text,reviewed_at text);
    CREATE TABLE station_standing_assignments(id text PRIMARY KEY,employee_id text,shift_type_id text,role text,active int DEFAULT 1);
    CREATE TABLE station_unavailability(employee_id text,off_date text);
    CREATE TABLE station_availability(employee_id text,availability_date text,status text,all_day int,start_time text,end_time text);
    CREATE TABLE station_distribution_weights(id int,seniority_weight real,hours_weight real,custom_weight real,custom_label text);`);
  let beforeBatch=null, failAt=-1;
  const client={rpc:async(name,args)=>{
    try {
      const execute=async(db,sql,mode)=>{
        const result=await db.query(sql);
        return mode==='first'?result.rows[0]??null:mode==='all'?result.rows:{success:true,meta:{changes:result.affectedRows}};
      };
      if(name.endsWith('_batch')) {
        if(beforeBatch) { const hook=beforeBatch;beforeBatch=null;await hook(); }
        return {error:null,data:await pg.transaction(async db=>{
          const out=[];
          for(const [i,s] of args.p_statements.entries()) {
            if(i===failAt)throw Error('fixture failure');
            const result=await execute(db,s.sql,s.mode);
            if(s.requiredChanges!==null&&result.meta.changes!==s.requiredChanges)throw Error('SAVE_CONFLICT');
            out.push(result);
          }
          return out;
        })};
      }
      return {error:null,data:await execute(pg,args.p_sql,args.p_mode)};
    } catch(error) { return {data:null,error:{message:error.message}}; }
  }};
  const db=load('db/postgres-adapter.ts').createPostgresD1Adapter(async()=>client);
  const sandbox={exports:{},Error,...consent,...logic,...load('app/staffing-eligibility.ts'),...load('app/schedule-time.ts'),...load('app/scheduler-member-view.ts'),
    chicagoToday:()=> '2099-01-01',ok:(body={})=>({status:200,...body}),bad:(error,status=400)=>({status,error})};
  vm.runInNewContext(ts.transpileModule(selectedVars+'\n'+selected+'\nexports.run=runAutoDistribution;', {compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,sandbox);
  const run=(payload={})=>sandbox.exports.run(db,{fromDate:'2099-01-07',endDate:'2099-01-07',...payload},()=>{},'Fixture admin');
  const claim=async(member='a',slot='slot',status='pending')=>pg.query("INSERT INTO station_shift_claims(id,slot_id,employee_id,role,status) VALUES($1,$2,$3,'FF/Attendant',$4)",[member+slot,slot,member,status]);
  const assign=async(member='a',shift='red-1')=>pg.query("INSERT INTO station_standing_assignments VALUES($1,$1,$2,'FF/Attendant',1)",[member,shift]);
  const rows=async()=> (await pg.query('SELECT employee_id,status FROM station_shift_slots ORDER BY id')).rows;
  return {pg,db,run,claim,assign,rows,intercept:fn=>{beforeBatch=fn;},fail:i=>{failAt=i;},rawRun:sandbox.exports.run};
}

test('qualified available members without requests remain unassigned despite client-supplied eligibility',async()=>{
  const f=await fixture();try{
    await f.pg.exec("INSERT INTO station_availability VALUES('a','2099-01-07','available',1,'','')");
    const result=await f.run({eligibility:{slot:['a']},assignments:[{slotId:'slot',employeeId:'a'}]});
    assert.equal(result.assigned,0);assert.equal(result.unfilled,1);assert.equal((await f.rows())[0].employee_id,null);
    await assert.rejects(f.rawRun(f.db,{},()=>{throw Error('admin only');}),/admin only/);
  }finally{await f.pg.close();}
});

test('exact request is assigned, approved and charged once; unrelated members and filled slots stay untouched',async()=>{
  const f=await fixture();try{
    await f.claim('b');
    assert.equal((await f.run()).assigned,1);
    assert.equal((await f.rows())[0].employee_id,'b');
    assert.deepEqual((await f.pg.query('SELECT status,reviewed_by FROM station_shift_claims')).rows,[{status:'approved',reviewed_by:'Fixture admin'}]);
    assert.equal((await f.run()).assigned,0);
    assert.equal((await f.pg.query("SELECT station_hours_this_period FROM employee_profiles WHERE employee_id='b'")).rows[0].station_hours_this_period,6);
  }finally{await f.pg.close();}
});

test('standing membership cannot spill into the other group or a one-day time override',async()=>{
  const f=await fixture();try{
    await f.assign('a','red-2'); assert.equal((await f.run()).assigned,0);
    await f.assign('b');
    await f.pg.exec("UPDATE station_shift_slots SET start_time='07:00'");assert.equal((await f.run()).assigned,0);
    await f.pg.exec("UPDATE station_shift_slots SET start_time=''");assert.equal((await f.run()).assigned,1);
    assert.equal((await f.rows())[0].employee_id,'b');
  }finally{await f.pg.close();}
});

test('qualification, inactive employee, time off and unavailable windows still block requests',async()=>{
  const f=await fixture();try{
    await f.claim();
    for(const [block,reset] of [
      ["UPDATE employees SET active=0 WHERE id='a'","UPDATE employees SET active=1 WHERE id='a'"],
      ["UPDATE employee_profiles SET end_date='2099-01-01' WHERE employee_id='a'","UPDATE employee_profiles SET end_date='' WHERE employee_id='a'"],
      ["UPDATE employee_profiles SET single_role=1 WHERE employee_id='a'","UPDATE employee_profiles SET single_role=0 WHERE employee_id='a'"],
      ["INSERT INTO station_unavailability VALUES('a','2099-01-07')","DELETE FROM station_unavailability"],
      ["INSERT INTO station_availability VALUES('a','2099-01-07','unavailable',0,'08:00','10:00')","DELETE FROM station_availability"],
    ]) { await f.pg.exec(block); assert.equal((await f.run()).assigned,0,block); await f.pg.exec(reset); }
    assert.equal((await f.run()).assigned,1);
  }finally{await f.pg.close();}
});

test('denied requests do not count, and extra positions need a request of their own',async()=>{
  const f=await fixture();try{
    await f.claim('a','slot','denied');await f.assign('b');
    await f.pg.exec("UPDATE station_shift_slots SET is_extra=1");assert.equal((await f.run()).assigned,0);
    await f.claim('c');assert.equal((await f.run()).assigned,1);assert.equal((await f.rows())[0].employee_id,'c');
  }finally{await f.pg.close();}
});

test('withdrawn request, removed standing assignment, modified hours and lost clearance fail closed before saving',async()=>{
  for(const mutation of ["UPDATE station_shift_claims SET status='withdrawn'","UPDATE station_standing_assignments SET active=0","UPDATE station_shift_slots SET start_time='07:00'","UPDATE employee_profiles SET single_role=1 WHERE employee_id='a'"]) {
    const f=await fixture();try{
      if(mutation.includes('standing'))await f.assign();else await f.claim();
      f.intercept(()=>f.pg.exec(mutation));
      const result=await f.run();assert.equal(result.status,409,JSON.stringify(result));
      assert.equal((await f.rows())[0].employee_id,null);
      assert.equal((await f.pg.query("SELECT station_hours_this_period FROM employee_profiles WHERE employee_id='a'")).rows[0].station_hours_this_period,0);
    }finally{await f.pg.close();}
  }
});

test('failed writes roll back slots, hours and request approval together',async()=>{
  const f=await fixture();try{
    await f.claim();f.fail(3);
    await assert.rejects(f.run(),/fixture failure/);
    assert.equal((await f.rows())[0].employee_id,null);
    assert.equal((await f.pg.query('SELECT status FROM station_shift_claims')).rows[0].status,'pending');
    assert.equal((await f.pg.query("SELECT station_hours_this_period FROM employee_profiles WHERE employee_id='a'")).rows[0].station_hours_this_period,0);
  }finally{await f.pg.close();}
});

test('another administrator filling the position cannot be overwritten or charged twice',async()=>{
  const f=await fixture();try{
    await f.claim();
    f.intercept(()=>f.pg.exec("UPDATE station_shift_slots SET employee_id='b',status='filled' WHERE id='slot'"));
    assert.equal((await f.run()).status,409);
    assert.equal((await f.rows())[0].employee_id,'b');
    assert.equal((await f.pg.query("SELECT station_hours_this_period FROM employee_profiles WHERE employee_id='a'")).rows[0].station_hours_this_period,0);
    assert.equal((await f.pg.query('SELECT status FROM station_shift_claims')).rows[0].status,'pending');
  }finally{await f.pg.close();}
});

test('a valid requester without an optional profile receives a profile and correct hours atomically',async()=>{
  const f=await fixture();try{
    await f.claim();await f.pg.exec("DELETE FROM employee_profiles WHERE employee_id='a'");
    assert.equal((await f.run()).assigned,1);
    assert.equal((await f.pg.query("SELECT station_hours_this_period FROM employee_profiles WHERE employee_id='a'")).rows[0].station_hours_this_period,6);
  }finally{await f.pg.close();}
});

test('previous-night booking prevents overlap even with an exact request',async()=>{
  const f=await fixture();try{
    await f.claim();
    await f.pg.exec("INSERT INTO station_schedule_entries VALUES('prior','2099-01-06','red-1'); INSERT INTO station_shift_slots(id,entry_id,role,status,employee_id,start_time,end_time) VALUES('prior-slot','prior','FF/Attendant','filled','a','18:00','08:00')");
    assert.equal((await f.run()).assigned,0);
  }finally{await f.pg.close();}
});

test('overnight assignments in the same run cannot overlap the next morning',()=>{
  const result=logic.autoDistribute([
    {slotId:'night',date:'2099-01-07',role:'FF/Attendant',hours:14,startTime:'18:00',endTime:'08:00'},
    {slotId:'morning',date:'2099-01-08',role:'FF/Attendant',hours:6,startTime:'06:00',endTime:'12:00'},
  ],[{employeeId:'a',name:'Fixture',seniority:1,hours:0,crossTrained:false}],{seniorityWeight:1,hoursWeight:1,customWeight:0,customLabel:''},{night:['a'],morning:['a']});
  assert.equal(result.length,1);
});

test('UI explains consent, open seats and the save action',()=>{
  const ui=fs.readFileSync(new URL('../app/station-scheduler.tsx',import.meta.url),'utf8');
  for(const text of ['Only requested shifts or saved recurring assignments.','Marking a day available does not request a shift.','Save eligible assignments','position(s) remain open'])assert.ok(ui.includes(text));
});
