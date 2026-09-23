import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { webcrypto } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { roundPayrollToCent } from '../app/payroll-rounding.ts';
import { dailyLogPayrollEntries, dailyLogPayrollTotals } from '../app/payroll-hours.ts';
import { completedDispatchReportNumbers } from '../app/dispatch-closure.ts';

// Runs the actual migration and adapter against an isolated PostgreSQL engine.
// No production credentials, records, or network requests are used.
const migration = fs.readFileSync(new URL('../supabase/migrations/20260908032620_portal_atomic_saves.sql', import.meta.url), 'utf8');
const source = fs.readFileSync(new URL('../db/postgres-adapter.ts',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'');
const sandbox = { exports: {}, Error, getSupabaseServerClient: () => { throw new Error('No production client in tests'); }, sqlLiteral: v => v == null ? 'NULL' : typeof v === 'number' ? String(v) : `'${String(v).replaceAll("'", "''")}'` };
vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,sandbox);

async function setup() {
  const pg = new PGlite();
  await pg.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA firehouse;
    CREATE TABLE firehouse.pay_periods(start_date text PRIMARY KEY,end_date text,status text);
    CREATE TABLE firehouse.time_entries(id text PRIMARY KEY,period_start text REFERENCES firehouse.pay_periods(start_date),hours numeric);
    CREATE TABLE firehouse.daily_logs(log_date text PRIMARY KEY,shift_notes text);
    CREATE TABLE firehouse.daily_log_staffing(id text PRIMARY KEY,log_date text);
    CREATE TABLE firehouse.daily_log_calls(id text PRIMARY KEY,log_date text);
    CREATE FUNCTION public.firehouse_sql(p_sql text,p_mode text DEFAULT 'all',p_secret text DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SET search_path=firehouse AS $$
    DECLARE result jsonb; affected bigint;
    BEGIN
      IF p_secret IS DISTINCT FROM 'test-only' THEN RAISE EXCEPTION 'Denied'; END IF;
      IF p_mode='run' THEN EXECUTE p_sql; GET DIAGNOSTICS affected=ROW_COUNT; RETURN jsonb_build_object('success',true,'meta',jsonb_build_object('changes',affected)); END IF;
      IF p_mode='first' THEN EXECUTE 'SELECT to_jsonb(r) FROM ('||p_sql||') r LIMIT 1' INTO result; RETURN result; END IF;
      EXECUTE 'SELECT coalesce(jsonb_agg(to_jsonb(r)),''[]''::jsonb) FROM ('||p_sql||') r' INTO result; RETURN result;
    END $$;
    CREATE FUNCTION public.firehouse_server_sql(p_sql text,p_mode text DEFAULT 'all',p_secret text DEFAULT NULL) RETURNS jsonb LANGUAGE sql AS $$ SELECT public.firehouse_sql(p_sql,p_mode,p_secret) $$;`);
  await pg.exec(migration);
  await pg.exec(`CREATE FUNCTION public.inventory_save_air_asset(uuid,uuid,timestamp with time zone,jsonb)
    RETURNS jsonb LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Fixture stale asset' USING ERRCODE='40001'; END $$;`);
  await pg.exec(fs.readFileSync(new URL('../supabase/migrations/20260923215051_nonretryable_save_conflicts.sql',import.meta.url),'utf8'));
  const calls=[];
  const batches=[];
  const client={async rpc(name,args) {
    calls.push(name);
    try {
      const batch=name.endsWith('_batch');
      if (batch) batches.push(args.p_statements);
      const {rows}=await pg.query(batch ? `SELECT public.${name}($1::jsonb,$2) AS result` : `SELECT public.${name}($1,$2,$3) AS result`,batch ? [JSON.stringify(args.p_statements),args.p_secret] : [args.p_sql,args.p_mode,args.p_secret]);
      return {data:rows[0].result,error:null};
    } catch(error) { return {data:null,error}; }
  }};
  const db=sandbox.exports.createPostgresD1Adapter(async()=>client,'firehouse_sql','test-only');
  return {pg,db,calls,batches};
}

test('stale saves return nonretryable HTTP conflict and atomically roll back both batch wrappers',async()=>{
  const {pg}=await setup();
  try {
    for(const rpc of ['firehouse_sql_batch','firehouse_server_sql_batch']) {
      const statements=[
        {sql:"INSERT INTO pay_periods VALUES ('fixture-period','fixture-end','draft')",mode:'run'},
        {sql:"UPDATE pay_periods SET status='changed' WHERE start_date='missing'",mode:'run',requiredChanges:1},
      ];
      await assert.rejects(pg.query(`SELECT public.${rpc}($1::jsonb,$2)`,[JSON.stringify(statements),'test-only']),error=>error.code==='PT409'&&/SAVE_CONFLICT/.test(error.message));
      assert.equal((await pg.query('SELECT count(*)::int n FROM firehouse.pay_periods')).rows[0].n,0);
      await assert.rejects(pg.query(`SELECT public.${rpc}($1::jsonb,$2)`,[JSON.stringify(statements),'wrong-secret']),/Denied/);
    }
    await assert.rejects(pg.query('SELECT public.inventory_save_air_asset(null,null,null,null)'),error=>error.code==='PT409');
    const identity=(await pg.query("SELECT prosecdef FROM pg_proc WHERE proname IN ('firehouse_sql_batch','firehouse_server_sql_batch')")).rows;
    assert.ok(identity.every(row=>!row.prosecdef));
  }finally{await pg.close();}
});

test('payroll rate validation and database failures never partially save settings or rates',async()=>{
  const {pg,db}=await setup();
  try {
    await pg.exec(`
      CREATE TABLE firehouse.employees(id text PRIMARY KEY,name text,active int);
      CREATE TABLE firehouse.employee_profiles(employee_id text,email text,is_admin int);
      CREATE TABLE firehouse.payroll_settings(id int PRIMARY KEY,overtime_threshold numeric,acting_officer_premium numeric,dpw_multiplier numeric,updated_at text);
      CREATE TABLE firehouse.pay_scales(id text PRIMARY KEY,regular_rate numeric NOT NULL,overtime_rate numeric NOT NULL,holiday_rate numeric NOT NULL);
      CREATE TABLE firehouse.pay_rate_history(id text PRIMARY KEY,pay_scale_id text REFERENCES firehouse.pay_scales(id),effective_date text,regular_rate numeric,overtime_rate numeric,holiday_rate numeric,created_by text,created_at text,UNIQUE(pay_scale_id,effective_date));
      CREATE TABLE firehouse.record_revisions(id text PRIMARY KEY,record_type text,record_id text,revision_number int,action text,summary text,actor text);
      INSERT INTO firehouse.payroll_settings VALUES(1,106,1,1.5,NULL);
      INSERT INTO firehouse.pay_scales VALUES('first',20,30,30),('second',22,33,33);
    `);
    let allowed=true;
    const route=fs.readFileSync(new URL('../app/api/payroll/route.ts',import.meta.url),'utf8').replace(/^import[\s\S]*?;\r?\n/gm,'');
    const context={exports:{},Error,Response,URL,crypto:webcrypto,ensureDatabase:async()=>db,roundPayrollToCent,ACTING_OFFICER_STIPEND_PER_HOUR:1,permissionsForEmail:async()=>new Set(allowed?['payroll.manage']:[])};
    vm.runInNewContext(ts.transpileModule(route,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context);
    const body={action:'saveRules',overtimeThreshold:100,dpwMultiplier:2,effectiveDate:'2099-01-11',payScales:[{id:'first',regularRate:24},{id:'second',regularRate:25}]};
    const post=body=>context.exports.POST(new Request('https://fixture.test/api/payroll',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}));
    const unchanged=async()=>{
      assert.equal(Number((await pg.query('SELECT overtime_threshold FROM firehouse.payroll_settings')).rows[0].overtime_threshold),106);
      assert.equal((await pg.query('SELECT count(*)::int AS n FROM firehouse.pay_rate_history')).rows[0].n,0);
      assert.equal((await pg.query('SELECT count(*)::int AS n FROM firehouse.record_revisions')).rows[0].n,0);
    };
    for (const change of [
      {payScales:[body.payScales[0],{id:'second',regularRate:-1}]},
      {payScales:[body.payScales[0],{id:'second',regularRate:''}]},
      {payScales:[body.payScales[0],body.payScales[0]]},
      {overtimeThreshold:-1},{dpwMultiplier:null},{effectiveDate:'2026-13-11'},
    ]) {assert.equal((await post({...body,...change})).status,400); await unchanged();}
    assert.equal((await post({...body,payScales:[body.payScales[0],{id:'missing',regularRate:25}]})).status,500);
    await unchanged();
    allowed=false; assert.equal((await post(body)).status,403); await unchanged(); allowed=true;
    assert.equal((await post(body)).status,200);
    assert.equal((await pg.query('SELECT count(*)::int AS n FROM firehouse.pay_rate_history')).rows[0].n,2);
    // Future rates do not null out current pay scales with no older history.
    assert.equal(Number((await pg.query("SELECT regular_rate FROM firehouse.pay_scales WHERE id='first'")).rows[0].regular_rate),20);
    assert.equal(Number((await pg.query("SELECT overtime_rate FROM firehouse.pay_rate_history WHERE pay_scale_id='first'")).rows[0].overtime_rate),36);
    for (const action of ['saveEntry','setPeriodStatus']) {
      assert.equal((await post({action,periodStart:'2026-13-11'})).status,400);
      assert.equal((await post({action})).status,400);
    }
  } finally {await pg.close();}
});

test('batch rolls back earlier writes when a later statement fails',async()=>{
  const {pg,db,calls}=await setup();
  try {
    await assert.rejects(db.batch([db.prepare("INSERT INTO daily_logs(log_date) VALUES (?)").bind('test-day'),db.prepare('INSERT INTO nonexistent VALUES (1)')]),/nonexistent/);
    assert.equal((await pg.query('SELECT count(*)::int AS n FROM firehouse.daily_logs')).rows[0].n,0);
    assert.deepEqual(calls,['firehouse_sql_batch']);
  } finally {await pg.close();}
});

test('stale version rejects an entire second save and keeps first editor data',async()=>{
  const {pg,db}=await setup();
  try {
    await pg.exec("INSERT INTO firehouse.daily_logs(log_date) VALUES('day')");
    const save=note=>db.batch([db.prepare('UPDATE daily_logs SET shift_notes=? WHERE log_date=? AND save_version=?').bind(note,'day',0).expectChanges(1),db.prepare('INSERT INTO daily_log_calls(id,log_date) VALUES(?,?)').bind(note,'day')]);
    const results=await Promise.allSettled([save('first'),save('second')]);
    assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
    assert.match(results.find(x=>x.status==='rejected').reason.message,/SAVE_CONFLICT/);
    assert.equal((await pg.query("SELECT shift_notes FROM firehouse.daily_logs WHERE log_date='day'")).rows[0].shift_notes,'first');
    assert.equal((await pg.query('SELECT count(*)::int AS n FROM firehouse.daily_log_calls')).rows[0].n,1);
  } finally {await pg.close();}
});

test('finalized periods reject insert, update and delete, including rollback of linked log changes',async()=>{
  const {pg,db}=await setup();
  try {
    await pg.exec("INSERT INTO firehouse.pay_periods VALUES('period','end','draft'); INSERT INTO firehouse.time_entries VALUES('entry','period',6); UPDATE firehouse.pay_periods SET status='finalized'; INSERT INTO firehouse.daily_logs(log_date) VALUES('day')");
    for(const sql of ["INSERT INTO time_entries VALUES('new','period',1)","UPDATE time_entries SET hours=12 WHERE id='entry'","DELETE FROM time_entries WHERE id='entry'"]) {
      await assert.rejects(db.batch([db.prepare("UPDATE daily_logs SET shift_notes='should rollback'"),db.prepare(sql)]),/PAYROLL_FINALIZED/);
      assert.equal((await pg.query('SELECT shift_notes FROM firehouse.daily_logs')).rows[0].shift_notes,null);
      assert.equal(Number((await pg.query('SELECT hours FROM firehouse.time_entries')).rows[0].hours),6);
    }
  } finally {await pg.close();}
});

test('batch preserves inserted counts, first results, quoting, and authentication failure',async()=>{
  const {pg,db}=await setup();
  try {
    const result=await db.batch([db.prepare('INSERT OR IGNORE INTO daily_logs(log_date,shift_notes) VALUES(?,?)').bind('day',"Officer's notes"),db.prepare('INSERT OR IGNORE INTO daily_logs(log_date) VALUES(?)').bind('day'),db.prepare('SELECT shift_notes AS shiftNotes FROM daily_logs').batchFirst()]);
    assert.equal(result[0].meta.changes,1); assert.equal(result[1].meta.changes,0); assert.equal(result[2].shiftNotes,"Officer's notes");
    await assert.rejects(pg.query('SELECT public.firehouse_sql_batch($1::jsonb,$2)',[JSON.stringify([{sql:'DELETE FROM daily_logs',mode:'run'}]),'invalid']),/Denied/);
    assert.equal((await pg.query('SELECT count(*)::int AS n FROM firehouse.daily_logs')).rows[0].n,1);
  } finally {await pg.close();}
});

test('actual callback review route rolls back approval on payroll failure and preserves manual baseline on retry',async()=>{
  const {pg,db}=await setup();
  try {
    await pg.exec(`
      ALTER TABLE firehouse.pay_periods ADD updated_by text, ADD updated_at text;
      ALTER TABLE firehouse.time_entries ADD employee_id text, ADD work_date text, ADD category text, ADD updated_at text;
      ALTER TABLE firehouse.time_entries ADD UNIQUE(employee_id,work_date,category);
      CREATE TABLE firehouse.employees(id text PRIMARY KEY,name text,pay_scale_id text,active int);
      CREATE TABLE firehouse.pay_scales(id text PRIMARY KEY,label text);
      CREATE TABLE firehouse.employee_profiles(employee_id text,email text,is_admin int DEFAULT 1);
      CREATE TABLE firehouse.record_revisions(id text PRIMARY KEY,record_type text,record_id text,revision_number int,action text,summary text,actor text);
      CREATE TABLE firehouse.callback_payroll_aggregates(employee_id text,work_date text,manual_baseline_hours numeric,updated_at timestamptz,PRIMARY KEY(employee_id,work_date));
      CREATE TABLE firehouse.daily_log_callback_submissions(id text PRIMARY KEY,employee_id text,reviewer_employee_id text,log_date text,status text,suggested_hours numeric,approved_hours numeric DEFAULT 0,reviewed_at timestamptz,reviewed_by text,review_note text);
      INSERT INTO firehouse.employees VALUES('reviewer','Fixture Reviewer','captain',1);
      INSERT INTO firehouse.pay_scales VALUES('captain','Captain');
      INSERT INTO firehouse.employee_profiles(employee_id,email) VALUES('reviewer','fixture@example.test');
      INSERT INTO firehouse.pay_periods(start_date,end_date,status) VALUES('2026-08-26','2026-09-10','draft');
      INSERT INTO firehouse.time_entries(id,period_start,hours,employee_id,work_date,category) VALUES('manual','2026-08-26',4,'member','2026-09-07','callback');
      INSERT INTO firehouse.daily_log_callback_submissions(id,employee_id,reviewer_employee_id,log_date,status,suggested_hours) VALUES('submission','member','reviewer','2026-09-07','pending',2);
      ALTER TABLE firehouse.time_entries ADD CONSTRAINT simulated_payroll_failure CHECK(hours<=4);
    `);
    const routeSource=fs.readFileSync(new URL('../app/api/callbacks/route.ts',import.meta.url),'utf8').replace(/^import[\s\S]*?;\r?\n/gm,'');
    let permitted=true;
    const context={exports:{},Error,Response,URL,crypto:webcrypto,console:{error(){}},ensureDatabase:async()=>db,hasPermission:async()=>permitted};
    vm.runInNewContext(ts.transpileModule(routeSource,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context);
    const request=()=>new Request('https://fixture.test/api/callbacks',{method:'POST',headers:{'content-type':'application/json','oai-authenticated-user-email':'fixture@example.test'},body:JSON.stringify({action:'review',id:'submission',status:'approved',approvedHours:2})});
    assert.equal((await context.exports.POST(request())).status,500);
    assert.equal((await pg.query('SELECT status FROM firehouse.daily_log_callback_submissions')).rows[0].status,'pending');
    assert.equal((await pg.query('SELECT count(*)::int AS n FROM firehouse.callback_payroll_aggregates')).rows[0].n,0);
    await pg.exec('ALTER TABLE firehouse.time_entries DROP CONSTRAINT simulated_payroll_failure');
    assert.equal((await context.exports.POST(request())).status,200);
    assert.equal((await context.exports.POST(request())).status,200);
    assert.equal(Number((await pg.query('SELECT hours FROM firehouse.time_entries')).rows[0].hours),6);
    assert.equal(Number((await pg.query('SELECT manual_baseline_hours FROM firehouse.callback_payroll_aggregates')).rows[0].manual_baseline_hours),4);
    const payrollSource=fs.readFileSync(new URL('../app/api/payroll/route.ts',import.meta.url),'utf8').replace(/^import[\s\S]*?;\r?\n/gm,'');
    const payrollContext={exports:{},Error,Response,URL,crypto:webcrypto,ensureDatabase:async()=>db,permissionsForEmail:async()=>new Set(['payroll.manage'])};
    vm.runInNewContext(ts.transpileModule(payrollSource,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,payrollContext);
    const manualRequest=hours=>new Request('https://fixture.test/api/payroll',{method:'POST',headers:{'content-type':'application/json','oai-authenticated-user-email':'fixture@example.test'},body:JSON.stringify({action:'saveEntry',periodStart:'2026-08-26',employeeId:'member',workDate:'2026-09-07',category:'callback',hours})});
    assert.equal((await payrollContext.exports.POST(manualRequest(1))).status,409);
    assert.equal((await payrollContext.exports.POST(manualRequest(10))).status,200);
    assert.equal((await context.exports.POST(request())).status,200);
    assert.equal(Number((await pg.query('SELECT hours FROM firehouse.time_entries')).rows[0].hours),10);
    assert.equal(Number((await pg.query('SELECT manual_baseline_hours FROM firehouse.callback_payroll_aggregates')).rows[0].manual_baseline_hours),8);
    permitted=false;
    assert.equal((await context.exports.POST(request())).status,403);
    permitted=true;
    await pg.exec("UPDATE firehouse.pay_periods SET status='finalized'");
    assert.equal((await context.exports.POST(request())).status,409);
    assert.equal(Number((await pg.query('SELECT hours FROM firehouse.time_entries')).rows[0].hours),10);
  } finally {await pg.close();}
});

test('actual Daily Log and payroll entry routes reject stale, finalized and unauthorized writes',async()=>{
  const {pg,db}=await setup();
  try {
    await pg.exec(`
      ALTER TABLE firehouse.pay_periods ADD updated_by text, ADD updated_at text;
      ALTER TABLE firehouse.time_entries ADD employee_id text, ADD work_date text, ADD category text, ADD updated_at text;
      ALTER TABLE firehouse.time_entries ADD UNIQUE(employee_id,work_date,category);
      ALTER TABLE firehouse.daily_logs ADD locked int DEFAULT 0, ADD locked_by text, ADD locked_at text, ADD admin_unlocked int DEFAULT 0, ADD updated_by text, ADD updated_at text;
      ALTER TABLE firehouse.daily_log_staffing ADD shift_key text, ADD employee_id text, ADD time_in text, ADD time_out text, ADD acting_officer int, ADD sort_order int;
      CREATE TABLE firehouse.employees(id text PRIMARY KEY,name text,pay_scale_id text,active int);
      CREATE TABLE firehouse.pay_scales(id text PRIMARY KEY,label text);
      CREATE TABLE firehouse.employee_profiles(employee_id text,email text,is_admin int,is_dpw int DEFAULT 0,acting_officer_eligible int DEFAULT 0);
      CREATE TABLE firehouse.record_revisions(id text PRIMARY KEY,record_type text,record_id text,revision_number int,action text,summary text,actor text);
      INSERT INTO firehouse.employees VALUES('member','Fixture Member','captain',1);
      INSERT INTO firehouse.pay_scales VALUES('captain','Captain');
      INSERT INTO firehouse.employee_profiles(employee_id,email,is_admin) VALUES('member','fixture@example.test',1);
      INSERT INTO firehouse.daily_logs(log_date) VALUES('2026-09-07');
    `);
    const context={exports:{},Error,Response,URL,crypto:webcrypto,console:{error(){}},ensureDatabase:async()=>db,
      hasPermission:async(_request,_db,permission)=>permission!=='permissions.manage',
      chicagoOperationalContext:()=>({operationalDate:'2026-09-07',lockBeforeDate:'2026-09-07'}),
      completedDispatchReportNumbers:()=>[],holidayForDate:()=>null,
      dailyLogPayrollTotals:()=>new Map([['member',6]]),
      dailyLogPayrollEntries:()=>[{employeeId:'member',category:'shift',hours:6}],
    };
    const loadRoute=path=>fs.readFileSync(new URL(path,import.meta.url),'utf8').replace(/^import[\s\S]*?;\r?\n/gm,'');
    vm.runInNewContext(ts.transpileModule(loadRoute('../app/api/logbook/route.ts'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context);
    const request=(body,email='fixture@example.test')=>new Request('https://fixture.test/api/logbook',{method:'POST',headers:{'content-type':'application/json','oai-authenticated-user-email':email},body:JSON.stringify(body)});
    const body={logDate:'2026-09-07',expectedVersion:0,shiftNotes:'first saved',staffing:[{id:'staff',employeeId:'member',shiftKey:'morning',timeIn:'06:00',timeOut:'12:00'}],calls:[]};
    const response=await context.exports.POST(request(body));
    assert.equal(response.status,200,JSON.stringify(await response.clone().json()));
    const version=(await response.json()).saveVersion;
    for (const invalid of [
      {...body,expectedVersion:version,staffing:undefined},
      {...body,expectedVersion:version,calls:null},
      {...body,expectedVersion:version,shiftNotes:undefined},
      {...body,expectedVersion:version,staffing:[{...body.staffing[0],shiftKey:'unknown'}]},
      {...body,expectedVersion:version,action:'typo'},
      {...body,expectedVersion:version,logDate:'2026-02-30'},
    ]) {
      assert.equal((await context.exports.POST(request(invalid))).status,400);
      assert.equal((await pg.query('SELECT shift_notes FROM firehouse.daily_logs')).rows[0].shift_notes,'first saved');
      assert.equal(Number((await pg.query('SELECT hours FROM firehouse.time_entries')).rows[0].hours),6);
    }
    assert.equal((await context.exports.POST(request({...body,shiftNotes:'stale attempt'}))).status,409);
    assert.equal((await context.exports.POST(request({action:'handoff',logDate:body.logDate,shiftKey:'morning',mode:'in',officerId:'member',reviewedNotes:true},'someone-else@example.test'))).status,403);
    await pg.exec("UPDATE firehouse.pay_periods SET status='finalized'");
    assert.equal((await context.exports.POST(request({...body,expectedVersion:version,shiftNotes:'closed attempt',staffing:[]}))).status,409);
    assert.equal((await pg.query('SELECT shift_notes FROM firehouse.daily_logs')).rows[0].shift_notes,'first saved');
    const payrollContext={exports:{},Error,Response,URL,crypto:webcrypto,ensureDatabase:async()=>db,permissionsForEmail:async()=>new Set(['payroll.manage'])};
    vm.runInNewContext(ts.transpileModule(loadRoute('../app/api/payroll/route.ts'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,payrollContext);
    const payrollBody={action:'saveEntry',periodStart:'2026-08-26',employeeId:'member',workDate:'2026-09-07',category:'shift',hours:12};
    assert.equal((await payrollContext.exports.POST(request(payrollBody))).status,409);
    assert.equal(Number((await pg.query('SELECT hours FROM firehouse.time_entries')).rows[0].hours),6);
    await pg.exec("UPDATE firehouse.pay_periods SET status='draft'");
    assert.equal((await payrollContext.exports.POST(request({...payrollBody,workDate:'2026-09-11'}))).status,400);
    assert.equal((await payrollContext.exports.POST(request(payrollBody))).status,200);
    assert.equal(Number((await pg.query('SELECT hours FROM firehouse.time_entries')).rows[0].hours),12);
  } finally {await pg.close();}
});

test('bulk Daily Log save preserves every row, hours, manual entries and atomic rollback with bounded statements', async () => {
  const { pg, db, batches } = await setup();
  try {
    await pg.exec(`
      ALTER TABLE firehouse.pay_periods ADD updated_by text, ADD updated_at text;
      ALTER TABLE firehouse.time_entries ADD employee_id text, ADD work_date text, ADD category text, ADD updated_at text;
      ALTER TABLE firehouse.time_entries ADD UNIQUE(employee_id,work_date,category);
      ALTER TABLE firehouse.daily_logs ADD locked int DEFAULT 0, ADD locked_by text, ADD locked_at text, ADD admin_unlocked int DEFAULT 0, ADD updated_by text, ADD updated_at text;
      ALTER TABLE firehouse.daily_log_staffing ADD shift_key text, ADD employee_id text, ADD time_in text, ADD time_out text, ADD acting_officer int, ADD sort_order int;
      ALTER TABLE firehouse.daily_log_calls ADD report_number text, ADD time_out text, ADD time_in text, ADD responding_units text, ADD address text, ADD call_type text, ADD sort_order int;
      CREATE TABLE firehouse.employee_profiles(employee_id text,is_dpw int DEFAULT 0);
      CREATE TABLE firehouse.dispatch_incidents(incident_id text,active int,cleared_at text);
      CREATE TABLE firehouse.record_revisions(id text PRIMARY KEY,record_type text,record_id text,revision_number int,action text,summary text,actor text);
      INSERT INTO firehouse.employee_profiles VALUES('dpw',1);
      INSERT INTO firehouse.daily_logs(log_date) VALUES('2026-09-07');
      INSERT INTO firehouse.daily_logs(log_date,locked,locked_by,locked_at,admin_unlocked) VALUES('2026-09-06',1,'Officer','existing timestamp',1);
      INSERT INTO firehouse.dispatch_incidents VALUES(' report-0 ',1,NULL),('report-1',1,NULL),('keep-active',1,NULL);
      INSERT INTO firehouse.pay_periods(start_date,end_date,status) VALUES('2026-08-26','2026-09-10','draft');
      INSERT INTO firehouse.time_entries(id,period_start,hours,employee_id,work_date,category) VALUES('manual','2026-08-26',2,'member','2026-09-07','callback');
    `);
    let allowed = true;
    const context = { exports: {}, Error, Response, URL, crypto: webcrypto, console: { error() {} }, ensureDatabase: async () => db,
      hasPermission: async () => allowed,
      chicagoOperationalContext: () => ({ operationalDate: '2026-09-07', lockBeforeDate: '2026-09-07' }),
      completedDispatchReportNumbers, holidayForDate: () => ({ name: 'Fixture holiday' }), dailyLogPayrollEntries, dailyLogPayrollTotals,
    };
    const route = fs.readFileSync(new URL('../app/api/logbook/route.ts', import.meta.url), 'utf8').replace(/^import[\s\S]*?;\r?\n/gm, '');
    vm.runInNewContext(ts.transpileModule(route, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, context);
    const body = { logDate: '2026-09-07', expectedVersion: 0, shiftNotes: "Officer's fixture notes",
      staffing: [
        { id: 'staff-1', employeeId: 'member', shiftKey: 'morning', timeIn: '06:00', timeOut: '12:00', actingOfficer: true },
        { id: 'staff-2', employeeId: 'member', shiftKey: 'overnight', timeIn: '18:00', timeOut: '06:00' },
        { id: 'staff-3', employeeId: 'dpw', shiftKey: 'afternoon', timeIn: '12:00', timeOut: '18:00' },
      ],
      calls: Array.from({ length: 205 }, (_, i) => ({ id: `call-${i}`, reportNumber: `report-${i}`, timeOut: '09:00', timeIn: i < 2 ? '09:45' : '', respondingUnits: 'Fixture unit', address: `Fixture ${i} Officer's Lane`, callType: 'EMS' })),
    };
    const post = payload => context.exports.POST(new Request('https://fixture.test/api/logbook', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) }));
    const response = await post(body);
    assert.equal(response.status, 200, JSON.stringify(await response.clone().json()));
    const version = (await response.json()).saveVersion;
    assert.ok(version > 0);
    // 205 calls use three inserts, not 205 independently authorized statements.
    assert.equal(batches[0].filter(s => /INSERT INTO daily_log_calls/.test(s.sql)).length, 3);
    assert.equal(batches[0].length, 14);
    const calls = (await pg.query('SELECT * FROM firehouse.daily_log_calls ORDER BY sort_order')).rows;
    assert.equal(calls.length, 205);
    assert.equal(calls[204].address, "Fixture 204 Officer's Lane");
    const payroll = async () => (await pg.query('SELECT employee_id,category,hours::float8 AS hours FROM firehouse.time_entries ORDER BY employee_id,category')).rows;
    const expectedPayroll = [
      { employee_id: 'dpw', category: 'dailyLogDpw', hours: 6 },
      { employee_id: 'member', category: 'actingOfficer', hours: 6 },
      { employee_id: 'member', category: 'callback', hours: 2 },
      { employee_id: 'member', category: 'holiday', hours: 18 },
    ];
    assert.deepEqual(await payroll(), expectedPayroll);
    assert.deepEqual((await pg.query('SELECT active FROM firehouse.dispatch_incidents ORDER BY incident_id')).rows.map(r => r.active), [0, 1, 0]);
    const history = (await pg.query("SELECT save_version,admin_unlocked,locked_at FROM firehouse.daily_logs WHERE log_date='2026-09-06'")).rows[0];
    assert.equal(Number(history.save_version), 0, 'Already-locked historical rows are not rewritten');
    assert.equal(history.admin_unlocked, 1);
    assert.equal(history.locked_at, 'existing timestamp');
    // Fail after log/call writes. The transaction must restore all of them.
    await pg.exec('ALTER TABLE firehouse.time_entries ADD CONSTRAINT fixture_reject_large_hours CHECK(hours<=20)');
    const failed = await post({ ...body, expectedVersion: version, shiftNotes: 'Must roll back', staffing: [{ ...body.staffing[0], timeOut: '06:00' }] });
    assert.equal(failed.status, 500);
    assert.deepEqual(await payroll(), expectedPayroll);
    assert.equal((await pg.query("SELECT shift_notes FROM firehouse.daily_logs WHERE log_date='2026-09-07'")).rows[0].shift_notes, body.shiftNotes);
    assert.equal((await pg.query('SELECT count(*)::int n FROM firehouse.daily_log_calls')).rows[0].n, 205);
    assert.equal((await post({ ...body, expectedVersion: 0 })).status, 409);
    allowed = false; assert.equal((await post({ ...body, expectedVersion: version })).status, 403); allowed = true;
    await pg.exec("UPDATE firehouse.pay_periods SET status='finalized'");
    assert.equal((await post({ ...body, expectedVersion: version, staffing: [], calls: [] })).status, 409);
    assert.deepEqual(await payroll(), expectedPayroll);
  } finally { await pg.close(); }
});
