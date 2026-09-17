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
const available = {employeeId:'a',availabilityDate:'2099-01-07',status:'available',allDay:0,startTime:'06:00',endTime:'12:00'};

test('only saved availability covering the entire shift grants consent', () => {
  const check = (rows, changes={}) => consent.distributionConsent({...position,...changes},'a',rows,[]);
  assert.equal(check([]),null);
  assert.ok(check([available]));
  for (const change of [{employeeId:'other'},{availabilityDate:'2099-01-08'},{status:'unavailable'},{status:'unknown'},{startTime:'07:00'},{endTime:'11:00'},{startTime:'bad'},{allDay:2}]) assert.equal(check([{...available,...change}]),null,JSON.stringify(change));
  for (const change of [{shiftActive:0},{startTime:'bad'},{entryDate:'2099-02-30'}]) assert.equal(check([available],change),null);
  assert.ok(check([{...available,startTime:'00:00',endTime:'18:00'}]));
  assert.ok(check([{...available,allDay:1}]));
  assert.equal(check([available],{startTime:'12:00',endTime:'18:00'}),null);
});

test('overnights need full calendar coverage and respect next-day and previous-night blocks', () => {
  const night={...position,startTime:'18:00',endTime:'06:00'};
  const check=(rows,off=[],slot=night)=>consent.distributionConsent(slot,'a',rows,off);
  const full={...available,allDay:1};
  const next={...full,availabilityDate:'2099-01-08'};
  const overnight={...available,startTime:'18:00',endTime:'06:00'};
  assert.equal(check([full]),null,'all day alone does not grant the next morning');
  assert.ok(check([full,next])); assert.ok(check([overnight]));
  assert.equal(check([overnight,{...next,status:'unavailable',allDay:0,startTime:'05:00',endTime:'08:00'}]),null);
  assert.equal(check([full,{...next,allDay:0,startTime:'01:00',endTime:'06:00'}]),null,'midnight gap');
  assert.equal(check([overnight],[{employeeId:'a',offDate:'2099-01-08'}]),null);
  assert.equal(check([available,{...overnight,availabilityDate:'2099-01-06',status:'unavailable',endTime:'08:00'}],[],position),null);
  assert.ok(check([{...overnight,availabilityDate:'2099-01-06',endTime:'12:00'}],[],position),'previous night explicitly covers morning');
  assert.ok(check([full],[],{...position,startTime:'18:00',endTime:'00:00'}),'midnight end needs no next-day consent');
  assert.ok(check([full,next],[],{...position,startTime:'06:00',endTime:'06:00'}),'24-hour shift spans two calendar dates');
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
  const markAvailable=async(member='a',date='2099-01-07',start='06:00',end='12:00',allDay=0)=>pg.query("INSERT INTO station_availability VALUES($1,$2,'available',$3,$4,$5)",[member,date,allDay,start,end]);
  const rows=async()=> (await pg.query('SELECT employee_id,status FROM station_shift_slots ORDER BY id')).rows;
  return {pg,db,run,claim,assign,markAvailable,rows,intercept:fn=>{beforeBatch=fn;},fail:i=>{failAt=i;},rawRun:sandbox.exports.run};
}

test('blank calendars never qualify even with requests, recurring membership or client-supplied eligibility',async()=>{
  const f=await fixture();try{
    await f.claim('a');await f.assign('b');
    const result=await f.run({eligibility:{slot:['a']},assignments:[{slotId:'slot',employeeId:'a'}]});
    assert.equal(result.assigned,0);assert.equal(result.unfilled,1);assert.equal((await f.rows())[0].employee_id,null);
    await assert.rejects(f.rawRun(f.db,{},()=>{throw Error('admin only');}),/admin only/);
  }finally{await f.pg.close();}
});

test('saved availability assigns without a request; unrelated members and filled slots stay untouched',async()=>{
  const f=await fixture();try{
    await f.markAvailable('b');
    assert.equal((await f.run()).assigned,1);
    assert.equal((await f.rows())[0].employee_id,'b');
    assert.equal((await f.pg.query('SELECT * FROM station_shift_claims')).rows.length,0);
    assert.equal((await f.run()).assigned,0);
    assert.equal((await f.pg.query("SELECT station_hours_this_period FROM employee_profiles WHERE employee_id='b'")).rows[0].station_hours_this_period,6);
  }finally{await f.pg.close();}
});

test('only the member with green calendar blocks is assigned, only within those times and dates',async()=>{
  const f=await fixture();try{
    await f.pg.exec("UPDATE employees SET name='Wyant fixture only' WHERE id='b'; INSERT INTO station_schedule_entries VALUES('afternoon','2099-01-11','red-1'),('morning','2099-01-12','red-1'),('blank','2099-01-13','red-1'); INSERT INTO station_shift_slots(id,entry_id,role,start_time,end_time) VALUES('match-afternoon','afternoon','FF/Attendant','12:00','18:00'),('wrong-afternoon','afternoon','FF/Attendant','06:00','12:00'),('match-morning','morning','FF/Attendant','06:00','12:00'),('wrong-morning','morning','FF/Attendant','12:00','18:00'),('blank-day','blank','FF/Attendant','06:00','12:00')");
    await f.markAvailable('b','2099-01-11','12:00','18:00');await f.markAvailable('b','2099-01-12','06:00','12:00');
    await f.assign('a'); await f.claim('c','wrong-afternoon');
    const result=await f.run({fromDate:'2099-01-11',endDate:'2099-01-13'});
    assert.equal(result.assigned,2);assert.equal(result.unfilled,3);
    assert.deepEqual((await f.pg.query("SELECT id,employee_id FROM station_shift_slots WHERE employee_id IS NOT NULL ORDER BY id")).rows,[{id:'match-afternoon',employee_id:'b'},{id:'match-morning',employee_id:'b'}]);
  }finally{await f.pg.close();}
});

test('qualification, inactive employee and time off still block an available member',async()=>{
  const f=await fixture();try{
    await f.markAvailable();
    for(const [block,reset] of [
      ["UPDATE employees SET active=0 WHERE id='a'","UPDATE employees SET active=1 WHERE id='a'"],
      ["UPDATE employee_profiles SET end_date='2099-01-01' WHERE employee_id='a'","UPDATE employee_profiles SET end_date='' WHERE employee_id='a'"],
      ["UPDATE employee_profiles SET single_role=1 WHERE employee_id='a'","UPDATE employee_profiles SET single_role=0 WHERE employee_id='a'"],
      ["INSERT INTO station_unavailability VALUES('a','2099-01-07')","DELETE FROM station_unavailability"],
      ["UPDATE station_availability SET status='unavailable'","UPDATE station_availability SET status='available'"],
    ]) { await f.pg.exec(block); assert.equal((await f.run()).assigned,0,block); await f.pg.exec(reset); }
    assert.equal((await f.run()).assigned,1);
  }finally{await f.pg.close();}
});

test('one-day extras also require saved availability, not standing membership or requests',async()=>{
  const f=await fixture();try{
    await f.claim('a','slot','denied');await f.assign('b');
    await f.pg.exec("UPDATE station_shift_slots SET is_extra=1");assert.equal((await f.run()).assigned,0);
    await f.claim('c');assert.equal((await f.run()).assigned,0);
    await f.markAvailable('c');assert.equal((await f.run()).assigned,1);assert.equal((await f.rows())[0].employee_id,'c');
  }finally{await f.pg.close();}
});

test('withdrawn availability, changed hours, new time off and lost clearance fail closed before saving',async()=>{
  for(const mutation of ["DELETE FROM station_availability","UPDATE station_availability SET status='unavailable'","UPDATE station_availability SET end_time='08:00'","INSERT INTO station_availability VALUES('a','2099-01-06','unavailable',0,'18:00','08:00')","INSERT INTO station_unavailability VALUES('a','2099-01-07')","UPDATE station_shift_slots SET start_time='07:00'","UPDATE employee_profiles SET single_role=1 WHERE employee_id='a'"]) {
    const f=await fixture();try{
      await f.markAvailable();
      f.intercept(()=>f.pg.exec(mutation));
      const result=await f.run();assert.equal(result.status,409,JSON.stringify(result));
      assert.equal((await f.rows())[0].employee_id,null);
      assert.equal((await f.pg.query("SELECT station_hours_this_period FROM employee_profiles WHERE employee_id='a'")).rows[0].station_hours_this_period,0);
    }finally{await f.pg.close();}
  }
});

test('failed writes roll back slots, hours and request approval together',async()=>{
  const f=await fixture();try{
    await f.claim();await f.markAvailable();f.fail(3);
    await assert.rejects(f.run(),/fixture failure/);
    assert.equal((await f.rows())[0].employee_id,null);
    assert.equal((await f.pg.query('SELECT status FROM station_shift_claims')).rows[0].status,'pending');
    assert.equal((await f.pg.query("SELECT station_hours_this_period FROM employee_profiles WHERE employee_id='a'")).rows[0].station_hours_this_period,0);
  }finally{await f.pg.close();}
});

test('another administrator filling the position cannot be overwritten or charged twice',async()=>{
  const f=await fixture();try{
    await f.claim();await f.markAvailable();
    f.intercept(()=>f.pg.exec("UPDATE station_shift_slots SET employee_id='b',status='filled' WHERE id='slot'"));
    assert.equal((await f.run()).status,409);
    assert.equal((await f.rows())[0].employee_id,'b');
    assert.equal((await f.pg.query("SELECT station_hours_this_period FROM employee_profiles WHERE employee_id='a'")).rows[0].station_hours_this_period,0);
    assert.equal((await f.pg.query('SELECT status FROM station_shift_claims')).rows[0].status,'pending');
  }finally{await f.pg.close();}
});

test('an available member without an optional profile receives a profile and correct hours atomically',async()=>{
  const f=await fixture();try{
    await f.markAvailable();await f.pg.exec("DELETE FROM employee_profiles WHERE employee_id='a'");
    assert.equal((await f.run()).assigned,1);
    assert.equal((await f.pg.query("SELECT station_hours_this_period FROM employee_profiles WHERE employee_id='a'")).rows[0].station_hours_this_period,6);
  }finally{await f.pg.close();}
});

test('previous-night booking prevents overlap even with saved availability',async()=>{
  const f=await fixture();try{
    await f.markAvailable();
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

test('UI explains the availability calendar, blank days, open seats and unchanged existing assignments',()=>{
  const ui=fs.readFileSync(new URL('../app/station-scheduler.tsx',import.meta.url),'utf8');
  for(const text of ['Only members with saved Available times.','Blank days never count as available.','Assign from saved availability','position(s) remain open','Existing assignments were not changed.','All day means midnight to midnight'])assert.ok(ui.includes(text),text);
  assert.ok(!ui.includes('Only requested shifts or saved recurring assignments.'));
});
