import {resolve} from 'node:path';
import {trainingModules} from './helpers/training-modules.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {fixture} from './helpers/ao-dst-db.mjs';
import {endpointChoices,staffingInterval,calendarWorkedHours,assertActingOfficerCoverage} from '../app/staffing-time.ts';
import {dailyLogPayrollTotals} from '../app/payroll-hours.ts';
import {logSnapshot,logDifferences} from '../app/daily-log-recovery.ts';
const instant=(hour,minute)=>`2026-11-01T${hour}:${minute}:00.000Z`;
const row=(id,timeIn,timeOut,timeInInstant='',timeOutInstant='')=>({id,employeeId:id==='a'?'a':'b',shiftKey:'overnight',timeIn,timeOut,timeInInstant,timeOutInstant,actingOfficer:true});
test('explicit occurrences resolve equal and decreasing clock labels within the fold, with dated next-day choice',()=>{
 const first=instant('06','30'),second=instant('07','30');
 const r=row('a','01:30','01:30',first,second);
 assert.equal((staffingInterval('2026-10-31',r).end-staffingInterval('2026-10-31',r).start)/3600000,1);
 assert.equal(calendarWorkedHours('2026-11-01','01:30','01:30',first,second),1);
 assert.equal(calendarWorkedHours('2026-11-01','01:45','01:15',instant('06','45'),instant('07','15')),.5);
 assert.equal(calendarWorkedHours('2026-11-01','01:30','01:30',first,'2026-11-02T07:30:00.000Z'),25);
 const options=endpointChoices('2026-11-01','01:30','01:30','out');
 assert.equal(options.length,3);assert.match(options[0].label,/First occurrence.*CDT.*UTC-05:00/);assert.match(options[1].label,/Second occurrence.*CST.*UTC-06:00/);assert.match(options[2].label,/Next day.*2026-11-02/);
 assert.throws(()=>calendarWorkedHours('2026-11-01','01:30','01:30',second,first),/after/);
 assert.throws(()=>calendarWorkedHours('2026-11-01','01:30','01:30',first,first),/after/);
});
test('first/second-hour AO handoffs are adjacent by instant, while genuine cross-occurrence overlaps are rejected',()=>{
 const rows=[row('a','01:00','01:30',instant('06','00'),instant('06','30')),row('b','01:30','01:30',instant('06','30'),instant('07','30')),row('c','01:30','02:00',instant('07','30'))];
 assert.doesNotThrow(()=>assertActingOfficerCoverage('2026-10-31',rows));
 assert.deepEqual([...dailyLogPayrollTotals(rows,null,'2026-10-31')].map(([id,t])=>[id,t.shift,t.actingOfficer]),[['a',.5,.5],['b',1.5,1.5]]);
 assert.throws(()=>assertActingOfficerCoverage('2026-10-31',[rows[0],row('b','01:15','01:45',instant('06','15'),instant('07','45'))]),/overlaps/);
});
test('ordinary defaults remain unchanged; nonexistent, missing, forged and stale selections fail closed',()=>{
 assert.equal(calendarWorkedHours('2026-10-16','18:00','06:00'),12);
 assert.equal(calendarWorkedHours('2026-10-16','06:00','06:00'),24);
 assert.throws(()=>calendarWorkedHours('2026-11-01','01:30','02:00'),/ambiguous/);
 assert.throws(()=>calendarWorkedHours('2026-03-08','02:30','06:00','2026-03-08T08:30:00.000Z'),/nonexistent/);
 assert.throws(()=>calendarWorkedHours('2026-10-16','01:30','02:00',instant('06','30')),/does not match/);
 assert.throws(()=>staffingInterval('2026-10-31',row('a','01:30','02:00','2026-11-01T06:31:00.000Z')),/does not match/);
});
test('actual save/read/edit retains occurrences and own pay; conflicting edits and stale snapshots preserve the saved version',async()=>{
 const f=await fixture();try{
  const date='2026-10-31';await f.prepare(date);
  const rows=[row('a','01:00','01:30',instant('06','00'),instant('06','30')),row('b','01:30','01:30',instant('06','30'),instant('07','30'))];
  let result=await f.post(date,rows);assert.equal(result.status,200,JSON.stringify(result));
  const loaded=await f.get(date);assert.equal(loaded.status,200,JSON.stringify(loaded));assert.equal(loaded.body.staffing.find(r=>r.id==='b').timeOutInstant,instant('07','30'));
  assert.deepEqual((await f.pg.query("SELECT employee_id,hours::float FROM firehouse.time_entries WHERE work_date=$1 AND category='actingOfficer' ORDER BY employee_id",[date])).rows,[{employee_id:'a',hours:.5},{employee_id:'b',hours:1}]);
  const before=(await f.pg.query('SELECT * FROM firehouse.time_entries ORDER BY id')).rows;
  const bad=[rows[0],row('b','01:15','01:45',instant('06','15'),instant('07','45'))];
  assert.equal((await f.post(date,bad)).status,400);assert.deepEqual((await f.pg.query('SELECT * FROM firehouse.time_entries ORDER BY id')).rows,before);
  const stale=loaded.body.log.saveVersion;
  result=await f.post(date,[rows[0],row('b','01:30','02:00',instant('07','30'))]);assert.equal(result.status,200,JSON.stringify(result));
  assert.equal((await f.post(date,rows,stale)).status,409);
  const edited=await f.get(date);assert.equal(edited.body.staffing.find(r=>r.id==='b').timeInInstant,instant('07','30'));
 }finally{await f.pg.close();}
});
test('historical occurrence clarification may retain pay, but cannot silently increase already posted hours',async()=>{
 const f=await fixture('2026-11-03');try{
  const date='2026-10-31';await f.prepare(date);
  await f.pg.exec("INSERT INTO firehouse.daily_log_staffing(id,log_date,employee_id,shift_key,time_in,time_out,acting_officer) VALUES('a','2026-10-31','a','overnight','01:15','01:45',1); INSERT INTO firehouse.pay_periods VALUES('2026-10-26','2026-11-10','draft',NULL); INSERT INTO firehouse.time_entries(id,employee_id,period_start,work_date,category,hours) VALUES('old','a','2026-10-26','2026-10-31','shift',0.5),('old-ao','a','2026-10-26','2026-10-31','actingOfficer',0.5)");
  const choice=row('a','01:15','01:45',instant('06','15'),instant('07','45'));
  const before=(await f.pg.query('SELECT * FROM firehouse.time_entries ORDER BY id')).rows;
  const blocked=await f.post(date,[choice]);assert.equal(blocked.status,409,JSON.stringify(blocked));assert.deepEqual((await f.pg.query('SELECT * FROM firehouse.time_entries ORDER BY id')).rows,before);
  assert.equal((await f.post(date,[row('a','01:15','01:45',instant('06','15'),instant('06','45'))])).status,200,'same-pay explicit clarification is preserved');
 }finally{await f.pg.close();}
});
test('draft comparison and recovery preserve occurrence-only edits',()=>{
 const saved={staffing:[row('a','01:15','01:45',instant('06','15'),instant('06','45'))],calls:[],shiftNotes:''};
 const draft={...saved,staffing:[{...saved.staffing[0],timeOutInstant:instant('07','45')}]};
 assert.equal(logSnapshot(draft).staffing[0].timeOutInstant,instant('07','45'));
 assert.deepEqual(logDifferences(draft,saved).map(d=>d.field),['timeOutInstant']);
});
test('review migration adds only empty default endpoint columns to legacy and isolated schemas without changing history/grants',async()=>{
 const pg=new PGlite();try{
  await pg.exec("CREATE SCHEMA firehouse; CREATE SCHEMA department_00000000000000000000000000000001; CREATE TABLE firehouse.daily_log_staffing(id text PRIMARY KEY,time_in text,time_out text); CREATE TABLE firehouse.work_detail_requests(id text PRIMARY KEY); CREATE TABLE department_00000000000000000000000000000001.daily_log_staffing(LIKE firehouse.daily_log_staffing INCLUDING ALL); INSERT INTO firehouse.daily_log_staffing VALUES('legacy','01:30','01:30');");
  await pg.exec(readFileSync('supabase/migrations/20261017004550_explicit_chicago_time_instants.sql','utf8'));
  assert.deepEqual((await pg.query('SELECT * FROM firehouse.daily_log_staffing')).rows,[{id:'legacy',time_in:'01:30',time_out:'01:30',time_in_instant:'',time_out_instant:''}]);
  await pg.exec("INSERT INTO department_00000000000000000000000000000001.daily_log_staffing(id,time_in_instant) VALUES('new','2026-11-01T06:30:00.000Z')");
  await assert.rejects(pg.exec("UPDATE firehouse.daily_log_staffing SET time_in_instant='first'"),/check constraint/);
 }finally{await pg.close();}
});

test('Work Detail submit and read preserve the selected instants for approval without changing explicit approved-hour policy',async()=>{
 const f=await fixture();try{
  const ddl=readFileSync('db/bootstrap.ts','utf8').split('\n').filter(line=>line.includes('CREATE TABLE IF NOT EXISTS work_detail_requests (')||line.includes('CREATE TABLE IF NOT EXISTS work_detail_members (')).map(line=>JSON.parse(line.match(/db\.prepare\((".*")\)/)[1]));
  for(const sql of ddl)await f.pg.exec(sql);
  await f.pg.exec(readFileSync('supabase/migrations/20261017004550_explicit_chicago_time_instants.sql','utf8'));
  await f.pg.exec("CREATE FUNCTION firehouse.employee_id_for_login(login text) RETURNS text LANGUAGE sql AS $$ SELECT employee_id FROM firehouse.employee_profiles WHERE email=login $$; UPDATE firehouse.pay_scales SET label='Captain'");
  const api=trainingModules({[resolve('db/bootstrap.ts')]:{ensureDatabase:async()=>f.db},[resolve('app/server-permissions.ts')]:{hasAnyPermission:async()=>true,hasPermission:async()=>true}})('app/api/work-details/route.ts');
  const request=body=>new Request('https://fixture.invalid/api/work-details',{method:body?'POST':'GET',headers:{'content-type':'application/json','oai-authenticated-user-email':'admin@example.test'},...(body?{body:JSON.stringify(body)}:{})});
  const response=await api.POST(request({action:'submit',workDate:'2026-11-01',startTime:'01:30',endTime:'01:30',timeInInstant:instant('06','30'),timeOutInstant:instant('07','30'),totalHours:1,employeeIds:['a'],requestingOfficerId:'a',approverId:'a',certified:true,workType:'Synthetic',description:'Synthetic only'}));
  assert.equal(response.status,200,await response.clone().text());
  const loaded=await api.GET(request());assert.equal(loaded.status,200,await loaded.clone().text());const record=(await loaded.json()).requests[0];
  assert.equal(record.timeInInstant,instant('06','30'));assert.equal(record.timeOutInstant,instant('07','30'));assert.equal(record.totalHours,1);assert.equal(record.status,'pending');
 }finally{await f.pg.close();}
});

test('an occurrence-only neighboring edit cannot race a department AO handoff',async()=>{
 const f=await fixture();try{
  await f.prepare('2026-10-30');await f.prepare('2026-10-31');
  await f.pg.query("INSERT INTO firehouse.daily_log_staffing(id,log_date,employee_id,shift_key,time_in,time_out,acting_officer,time_out_instant) VALUES('neighbor','2026-10-30','b','overnight','05:00','01:30',1,$1)",[instant('06','30')]);
  f.state.beforeBatch=async pg=>{await pg.query("UPDATE firehouse.daily_log_staffing SET time_out_instant=$1 WHERE id='neighbor'",[instant('07','30')]);};
  const result=await f.post('2026-10-31',[row('a','01:30','02:00',instant('06','30'))]);
  assert.equal(result.status,409,JSON.stringify(result));
  assert.equal((await f.pg.query("SELECT count(*) n FROM firehouse.daily_log_staffing WHERE log_date='2026-10-31'")).rows[0].n,0);
  assert.equal((await f.post('2026-10-31',[row('a','01:30','02:00',instant('06','30'))])).status,400);
  assert.equal((await f.post('2026-10-31',[row('a','01:30','02:00',instant('07','30'))])).status,200);
 }finally{await f.pg.close();}
});
