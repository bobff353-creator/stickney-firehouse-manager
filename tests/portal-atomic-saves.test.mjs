import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { webcrypto } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';

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
  const calls=[];
  const client={async rpc(name,args) {
    calls.push(name);
    try {
      const batch=name.endsWith('_batch');
      const {rows}=await pg.query(batch ? `SELECT public.${name}($1::jsonb,$2) AS result` : `SELECT public.${name}($1,$2,$3) AS result`,batch ? [JSON.stringify(args.p_statements),args.p_secret] : [args.p_sql,args.p_mode,args.p_secret]);
      return {data:rows[0].result,error:null};
    } catch(error) { return {data:null,error}; }
  }};
  const db=sandbox.exports.createPostgresD1Adapter(async()=>client,'firehouse_sql','test-only');
  return {pg,db,calls};
}

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
