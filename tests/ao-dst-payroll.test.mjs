import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { calendarWorkedHours, staffingInterval, chicagoLocalInstant, assertActingOfficerCoverage } from '../app/staffing-time.ts';
import { dailyLogPayrollTotals, dailyLogPayrollEntries, workedHours } from '../app/payroll-hours.ts';
import { summarizePayroll } from '../app/payroll-calculation.ts';
import { payrollDatabaseFixture } from './helpers/payroll-submission-db.mjs';
import { trainingModules } from './helpers/training-modules.mjs';
import * as operational from '../app/operational-day.ts';
const row=(employeeId,timeIn,timeOut,actingOfficer=true)=>({employeeId,timeIn,timeOut,actingOfficer,shiftKey:'overnight'});

test('elapsed Chicago nights pay 12 ordinary, 11 spring-forward and 13 fall-back hours, including each AO allowance',()=>{
  for(const [date,hours] of [['2026-09-18',12],['2026-03-07',11],['2026-10-31',13]]) {
    const totals=dailyLogPayrollTotals([row('a','18:00','06:00')],null,date);
    assert.deepEqual(totals.get('a'),{shift:hours,holiday:0,actingOfficer:hours});
    const pay=summarizePayroll({regularRate:20},dailyLogPayrollEntries(totals,new Set()),{overtimeThreshold:106,dpwMultiplier:1.5,actingOfficerPremium:1});
    assert.equal(pay.gross,hours*21);
  }
  assert.equal(workedHours('06:00','06:00','2026-03-07'),23);
  assert.equal(workedHours('06:00','06:00','2026-10-31'),25);
});
test('two/three/one-hour AO handoffs preserve each member and allow adjacent boundaries, not overlaps',()=>{
  const rows=[row('a','06:00','08:00'),row('b','08:00','11:00'),row('c','11:00','12:00')];
  assert.doesNotThrow(()=>assertActingOfficerCoverage('2026-10-16',rows));
  assert.deepEqual([...dailyLogPayrollTotals(rows,null,'2026-10-16')].map(([id,t])=>[id,t.shift,t.actingOfficer]),[['a',2,2],['b',3,3],['c',1,1]]);
  assert.throws(()=>assertActingOfficerCoverage('2026-10-16',[rows[0],row('b','07:45','11:00')]),/overlaps/);
  assert.throws(()=>assertActingOfficerCoverage('2026-10-16',[rows[0],rows[0]]),/overlaps/);
});
test('AO coverage uses department-wide absolute intervals across shift keys, midnight and adjacent operational logs',()=>{
  const rows=[row('a','23:00','00:00'),row('b','00:00','03:00'),row('c','03:00','06:00')];
  assert.doesNotThrow(()=>assertActingOfficerCoverage('2026-10-16',rows));
  assert.throws(()=>assertActingOfficerCoverage('2026-10-16',[rows[0],row('b','23:45','02:00')]),/overlaps/);
  assert.throws(()=>assertActingOfficerCoverage('2026-10-17',[row('b','06:00','08:00')],[{...row('a','18:00','07:00'),logDate:'2026-10-16'}]),/overlaps/);
  assert.doesNotThrow(()=>assertActingOfficerCoverage('2026-10-17',[row('b','07:00','08:00')],[{...row('a','18:00','07:00'),logDate:'2026-10-16'}]));
});
test('ambiguous and nonexistent endpoints fail safely; valid surrounding endpoints resolve elapsed time',()=>{
  for(const time of ['01:00','01:15','01:30','01:45']) assert.throws(()=>chicagoLocalInstant('2026-11-01',time),/ambiguous/);
  for(const time of ['02:00','02:15','02:30','02:45']) assert.throws(()=>chicagoLocalInstant('2026-03-08',time),/nonexistent/);
  assert.equal(staffingInterval('2026-03-07',row('a','18:00','06:00')).end,Date.parse('2026-03-08T11:00:00Z'));
  assert.throws(()=>assertActingOfficerCoverage('2026-10-16',[row('a','','06:00')]),/complete/);
  assert.throws(()=>chicagoLocalInstant('2026-02-30','06:00'),/valid/);
});

async function fixture() {
  const f=await payrollDatabaseFixture();
  await f.pg.exec(`ALTER TABLE firehouse.daily_logs ADD locked int DEFAULT 0,ADD locked_by text,ADD locked_at text,ADD admin_unlocked int DEFAULT 0,ADD updated_at text;
    ALTER TABLE firehouse.daily_log_staffing ADD acting_officer int DEFAULT 0,ADD sort_order int;
    ALTER TABLE firehouse.daily_log_calls ADD report_number text,ADD time_out text,ADD time_in text,ADD responding_units text,ADD address text,ADD call_type text,ADD sort_order int;
    ALTER TABLE firehouse.pay_periods ADD updated_by text;
    ALTER TABLE firehouse.time_entries ADD updated_at text;
    ALTER TABLE firehouse.employee_profiles ADD acting_officer_eligible int DEFAULT 1;
    ALTER TABLE firehouse.daily_log_approvals ADD sign_in_at text,ADD sign_in_officer_id text,ADD sign_out_officer_id text,ADD sign_in_equipment text,ADD sign_in_note text,ADD reviewed_notes int,ADD sign_out_equipment text,ADD sign_out_note text,ADD fleet_duties_acknowledged int;
    CREATE TABLE firehouse.dispatch_incidents(incident_id text,active int,cleared_at text);`);
  const api=trainingModules({[resolve('db/bootstrap.ts')]:{ensureDatabase:async()=>f.db},[resolve('app/server-permissions.ts')]:{hasPermission:async()=>true},[resolve('app/operational-day.ts')]:{...operational,chicagoOperationalContext:()=>({operationalDate:'2026-10-16',lockBeforeDate:'1900-01-01'})}})('app/api/logbook/route.ts');
  const prepare=async date=>f.pg.query('INSERT INTO firehouse.daily_logs(log_date) VALUES($1) ON CONFLICT DO NOTHING',[date]);
  const version=async date=>(await f.pg.query('SELECT save_version FROM firehouse.daily_logs WHERE log_date=$1',[date])).rows[0].save_version;
  const post=async(date,rows,expectedVersion=undefined)=>{
    const response=await api.POST(new Request('https://fixture.invalid/api/logbook',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({logDate:date,action:'save',expectedVersion:expectedVersion??await version(date),staffing:rows,calls:[],shiftNotes:'Synthetic clarified rules'})}));
    return{status:response.status,body:await response.json()};
  };
  const handoff=async date=>api.POST(new Request('https://fixture.invalid/api/logbook',{method:'POST',headers:{'content-type':'application/json','oai-authenticated-user-email':'admin@example.test'},body:JSON.stringify({logDate:date,action:'handoff',shiftKey:'morning',mode:'in',officerId:'a',reviewedNotes:true})}));
  return{...f,prepare,version,post,handoff};
}
test('actual save posts elapsed hours and AO handoffs atomically; bad edits and finalized payroll preserve records',async()=>{
  const f=await fixture();try{
    for(const [date,hours] of [['2026-03-07',11],['2026-10-31',13],['2026-10-16',12]]) {
      await f.prepare(date);const r=await f.post(date,[row('a','18:00','06:00')]);assert.equal(r.status,200,JSON.stringify(r));
      assert.deepEqual((await f.pg.query("SELECT category,hours::float FROM firehouse.time_entries WHERE work_date=$1 ORDER BY category",[date])).rows,[{category:'actingOfficer',hours},{category:'shift',hours}]);
    }
    const date='2026-10-16',rows=[row('a','06:00','08:00'),row('b','08:00','11:00'),row('c','11:00','12:00')];
    assert.equal((await f.post(date,rows)).status,200);
    const before=(await f.pg.query('SELECT * FROM firehouse.time_entries ORDER BY id')).rows;
    assert.equal((await f.post(date,[rows[0],row('b','07:45','12:00')])).status,400);
    assert.deepEqual((await f.pg.query('SELECT * FROM firehouse.time_entries ORDER BY id')).rows,before);
    await f.pg.exec("UPDATE firehouse.pay_periods SET status='finalized' WHERE start_date='2026-10-11'");
    assert.equal((await f.post(date,[row('a','06:00','07:00')])).status,409);
    assert.deepEqual((await f.pg.query('SELECT * FROM firehouse.time_entries ORDER BY id')).rows,before);
    assert.equal((await f.post('2026-03-07',[row('a','01:30','06:00')])).status,200,'01:30 before spring jump exists');
    assert.equal((await f.post('2026-03-07',[row('a','02:30','06:00')])).status,400);
    assert.equal((await f.post('2026-10-31',[row('a','01:30','06:00')])).status,400);
  }finally{await f.pg.close();}
});
test('a neighboring assignment inserted after validation invalidates the transaction snapshot, including a previously missing log',async()=>{
  const f=await fixture();try{
    await f.prepare('2026-10-17');
    f.state.beforeBatch=async pg=>{await pg.exec("INSERT INTO firehouse.daily_logs(log_date) VALUES('2026-10-16'); INSERT INTO firehouse.daily_log_staffing(id,log_date,employee_id,shift_key,time_in,time_out,acting_officer) VALUES('racing','2026-10-16','b','overnight','18:00','07:00',1)");};
    const result=await f.post('2026-10-17',[row('a','06:00','08:00')]);assert.equal(result.status,409,JSON.stringify(result));
    assert.equal((await f.pg.query("SELECT count(*) n FROM firehouse.daily_log_staffing WHERE log_date='2026-10-17'")).rows[0].n,0);
    assert.equal((await f.pg.query("SELECT count(*) n FROM firehouse.time_entries WHERE work_date='2026-10-17'")).rows[0].n,0);
    assert.equal((await f.post('2026-10-17',[row('a','06:00','08:00')])).status,400,'retry now sees the conflicting saved assignment');
    assert.equal((await f.post('2026-10-17',[row('a','07:00','08:00')])).status,200);
  }finally{await f.pg.close();}
});

test('officer approval advances the version even in the same second; a racing staffing edit cannot overwrite it',async()=>{
  const f=await fixture();try{
    const date='2026-10-16';await f.prepare(date);
    assert.equal((await f.post(date,[row('a','06:00','08:00')])).status,200);
    const before=await f.version(date);
    f.state.beforeBatch=async()=>{const response=await f.handoff(date);assert.equal(response.status,200,await response.text());};
    const response=await f.post(date,[row('b','06:00','08:00')],before);
    assert.equal(response.status,409);
    assert.equal((await f.pg.query("SELECT employee_id FROM firehouse.daily_log_staffing WHERE log_date=$1",[date])).rows[0].employee_id,'a');
    assert.ok(await f.version(date)>before);
    assert.equal((await f.pg.query("SELECT count(*) n FROM firehouse.daily_log_approvals WHERE log_date=$1 AND sign_in_at IS NOT NULL",[date])).rows[0].n,1);
  }finally{await f.pg.close();}
});

test('calendar-dated optional work-detail suggestions use elapsed time without moving pre-6 a.m. starts to a different date',()=>{
  assert.equal(calendarWorkedHours('2026-03-07','18:00','06:00'),11);
  assert.equal(calendarWorkedHours('2026-10-31','18:00','06:00'),13);
  assert.equal(calendarWorkedHours('2026-03-08','00:00','06:00'),5);
  assert.equal(calendarWorkedHours('2026-11-01','00:00','06:00'),7);
  assert.throws(()=>calendarWorkedHours('2026-11-01','01:30','06:00'),/ambiguous/);
});

test('historical posted clock-hour pay is not silently converted by a later Daily Log edit',async()=>{
  const f=await fixture();try{
    const date='2026-03-07';await f.prepare(date);
    await f.pg.exec("INSERT INTO firehouse.daily_log_staffing(id,log_date,employee_id,shift_key,time_in,time_out,acting_officer) VALUES('legacy','2026-03-07','a','overnight','18:00','06:00',1); INSERT INTO firehouse.pay_periods(start_date,end_date,status) VALUES('2026-02-26','2026-03-10','draft'); INSERT INTO firehouse.time_entries(id,employee_id,period_start,work_date,category,hours) VALUES('legacy-hours','a','2026-02-26','2026-03-07','shift',12)");
    const before=(await f.pg.query('SELECT * FROM firehouse.time_entries ORDER BY id')).rows;
    const result=await f.post(date,[row('a','18:00','06:00')]);
    assert.equal(result.status,409);assert.match(result.body.error,/explicit correction review/);
    assert.deepEqual((await f.pg.query('SELECT * FROM firehouse.time_entries ORDER BY id')).rows,before);
  }finally{await f.pg.close();}
});

test('work-detail API rejects ambiguous/nonexistent optional timestamps before any write, even with manually entered hours',async()=>{
  let writes=0;
  const db={prepare(){const q={bind(){return q;},first:async()=>({id:'a',name:'Synthetic',rank:'Captain',isAdmin:1}),run:async()=>{writes++;}};return q;},batch:async()=>{writes++;}};
  const api=trainingModules({[resolve('db/bootstrap.ts')]:{ensureDatabase:async()=>db},[resolve('app/server-permissions.ts')]:{hasAnyPermission:async()=>true,hasPermission:async()=>true}})('app/api/work-details/route.ts');
  for(const [workDate,startTime,message] of [['2026-11-01','01:30','ambiguous'],['2026-03-08','02:30','nonexistent'],['bad','18:00','valid']]) {
    const response=await api.POST(new Request('https://fixture.invalid/api/work-details',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'submit',workDate,startTime,endTime:'06:00',totalHours:12,employeeIds:['a'],requestingOfficerId:'a',approverId:'a',certified:true,workType:'Synthetic',description:'Local only'})}));
    assert.equal(response.status,400);assert.match((await response.json()).error,new RegExp(message));
  }
  assert.equal(writes,0);
});
